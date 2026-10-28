const express = require("express");
const { getPrisma } = require("../db");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
const CATEGORIES = new Set(["Books", "Cycles", "Electronics", "Accessories", "Calculators"]);
const CONDITIONS = new Set(["New", "Like New", "Good", "Fair"]);

function parsePaise(value) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const paise = Number(`${whole}${fraction.padEnd(2, "0")}`);
  return Number.isSafeInteger(paise) ? paise : null;
}

function listingResponse(listing) {
  const current = listing.currentBidPaise ?? listing.startingPricePaise;
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    condition: listing.condition,
    startingPrice: listing.startingPricePaise / 100,
    currentBid: current / 100,
    minimumNextBid: (listing.currentBidPaise === null
      ? listing.startingPricePaise
      : current + listing.minimumIncrementPaise) / 100,
    minimumIncrement: listing.minimumIncrementPaise / 100,
    auctionEndsAt: listing.auctionEndsAt,
    status: listing.status,
    bids: listing._count?.bids ?? listing.bids?.length ?? 0,
    seller: listing.seller ? { id: listing.seller.id, name: listing.seller.name } : undefined,
    images: listing.images?.map((image) => ({ id: image.id, url: image.url })) ?? [],
  };
}

function validateListingInput(body, { creating = false } = {}) {
  const errors = [];
  if (typeof body.title !== "string" || body.title.trim().length < 3) errors.push("Title must be at least 3 characters.");
  if (typeof body.description !== "string" || body.description.trim().length < 10) errors.push("Description must be at least 10 characters.");
  if (!CATEGORIES.has(body.category)) errors.push("Choose a supported category.");
  if (!CONDITIONS.has(body.condition)) errors.push("Choose a supported condition.");
  const startingPricePaise = parsePaise(body.startingPrice);
  const minimumIncrementPaise = parsePaise(body.minimumIncrement);
  if (!startingPricePaise || startingPricePaise <= 0) errors.push("Starting price must be positive.");
  if (!minimumIncrementPaise || minimumIncrementPaise <= 0) errors.push("Minimum increment must be positive.");
  const auctionEndsAt = new Date(body.auctionEndsAt);
  if (creating && (Number.isNaN(auctionEndsAt.getTime()) || auctionEndsAt.getTime() <= Date.now())) {
    errors.push("Auction deadline must be a valid future date.");
  }
  return { errors, startingPricePaise, minimumIncrementPaise, auctionEndsAt };
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 9, 1), 50);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where = {
      status: "OPEN",
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : {}),
      ...(CATEGORIES.has(req.query.category) ? { category: req.query.category } : {}),
      ...(CONDITIONS.has(req.query.condition) ? { condition: req.query.condition } : {}),
    };
    const prisma = await getPrisma();
    const [listings, total] = await prisma.$transaction([
      prisma.listing.findMany({
        where,
        orderBy: req.query.sort === "price-low" ? { startingPricePaise: "asc" } : { auctionEndsAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { bids: true } }, images: true, seller: { select: { id: true, name: true } } },
      }),
      prisma.listing.count({ where }),
    ]);
    res.json({ success: true, data: listings.map(listingResponse), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
});

router.get("/mine", requireAuth, requireRole("SELLER", "ADMIN"), async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const listings = await prisma.listing.findMany({
      where: req.user.role === "ADMIN" ? {} : { sellerId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { bids: true } }, images: true, seller: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: listings.map(listingResponse) });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireRole("SELLER", "ADMIN"), async (req, res, next) => {
  try {
    const { errors, startingPricePaise, minimumIncrementPaise, auctionEndsAt } = validateListingInput(req.body, { creating: true });
    if (errors.length) return res.status(400).json({ code: "VALIDATION_ERROR", message: errors.join(" ") });
    const prisma = await getPrisma();
    const listing = await prisma.listing.create({
      data: {
        sellerId: req.user.id,
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        category: req.body.category,
        condition: req.body.condition,
        startingPricePaise,
        minimumIncrementPaise,
        auctionEndsAt,
        images: {
          create: Array.isArray(req.body.imageUrls)
            ? req.body.imageUrls.filter((url) => typeof url === "string" && /^https?:\/\//.test(url)).slice(0, 6).map((url) => ({ url }))
            : [],
        },
      },
      include: { images: true, _count: { select: { bids: true } }, seller: { select: { id: true, name: true } } },
    });
    const savedSearches = await prisma.savedSearch.findMany({
      where: {
        userId: { not: req.user.id },
        AND: [{
          OR: [
            { category: null },
            { category: listing.category },
          ],
        }, ...(req.body.title ? [{
          OR: [
            { query: null },
            { query: { contains: req.body.title.trim().split(/\s+/)[0], mode: "insensitive" } },
          ],
        }] : [])],
      },
      select: { id: true, userId: true, name: true, maxPricePaise: true },
    });
    const matchingSearches = savedSearches.filter((search) => !search.maxPricePaise || search.maxPricePaise >= listing.startingPricePaise);
    if (matchingSearches.length) {
      await prisma.notification.createMany({
        data: matchingSearches.map((search) => ({
          userId: search.userId,
          type: "SYSTEM",
          entityId: listing.id,
          title: `New match for ${search.name}`,
          message: `${listing.title} matches one of your saved searches.`,
          dedupeKey: `saved-search:${search.id}:listing:${listing.id}`,
        })),
        skipDuplicates: true,
      });
    }
    res.status(201).json({ success: true, data: listingResponse(listing) });
  } catch (error) {
    next(error);
  }
});

router.get("/:listingId", async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.listingId },
      include: { images: true, _count: { select: { bids: true } }, seller: { select: { id: true, name: true } } },
    });
    if (!listing) return res.status(404).json({ code: "LISTING_NOT_FOUND", message: "Listing not found." });
    res.json({ success: true, data: listingResponse(listing) });
  } catch (error) {
    next(error);
  }
});

router.get("/:listingId/bids", requireAuth, async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const listing = await prisma.listing.findUnique({ where: { id: req.params.listingId }, select: { sellerId: true } });
    if (!listing) return res.status(404).json({ code: "LISTING_NOT_FOUND", message: "Listing not found." });
    if (listing.sellerId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only the seller or an administrator can view bid history." });
    }
    const bids = await prisma.bid.findMany({ where: { listingId: req.params.listingId }, orderBy: [{ amountPaise: "desc" }, { createdAt: "asc" }], select: { id: true, amountPaise: true, createdAt: true } });
    res.json({ success: true, data: bids.map((bid) => ({ ...bid, amount: bid.amountPaise / 100 })) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:listingId", requireAuth, requireRole("SELLER", "ADMIN"), async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const existing = await prisma.listing.findUnique({ where: { id: req.params.listingId }, include: { _count: { select: { bids: true } } } });
    if (!existing || (req.user.role !== "ADMIN" && existing.sellerId !== req.user.id)) {
      return res.status(404).json({ message: "Listing not found." });
    }
    if (existing.status !== "OPEN" || existing._count.bids > 0) {
      return res.status(409).json({ message: "A listing cannot be edited after bidding starts." });
    }
    const allowed = ["title", "description", "category", "condition", "auctionEndsAt"];
    const data = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    const validation = validateListingInput({ ...existing, ...data, startingPrice: existing.startingPricePaise / 100, minimumIncrement: existing.minimumIncrementPaise / 100 }, { creating: true });
    if (validation.errors.length) return res.status(400).json({ code: "VALIDATION_ERROR", message: validation.errors.join(" ") });
    const listing = await prisma.listing.update({
      where: { id: existing.id },
      data: { ...data, title: data.title?.trim(), description: data.description?.trim(), auctionEndsAt: data.auctionEndsAt ? new Date(data.auctionEndsAt) : undefined },
      include: { images: true, _count: { select: { bids: true } }, seller: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: listingResponse(listing) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:listingId", requireAuth, requireRole("SELLER", "ADMIN"), async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const existing = await prisma.listing.findUnique({ where: { id: req.params.listingId }, include: { _count: { select: { bids: true } } } });
    if (!existing || (req.user.role !== "ADMIN" && existing.sellerId !== req.user.id)) return res.status(404).json({ message: "Listing not found." });
    if (existing._count.bids > 0) return res.status(409).json({ message: "Listings with bids cannot be cancelled through this endpoint." });
    await prisma.listing.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:listingId/auto-bid", requireAuth, requireRole("BUYER"), async (req, res, next) => {
  try {
    const maxPaise = parsePaise(req.body.maxAmount);
    if (!maxPaise || maxPaise <= 0) return res.status(400).json({ message: "Enter a valid maximum bid." });
    const prisma = await getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: req.params.listingId } });
      if (!listing || listing.status !== "OPEN" || listing.auctionEndsAt.getTime() <= Date.now()) throw Object.assign(new Error("This auction is closed."), { status: 409 });
      if (listing.sellerId === req.user.id) throw Object.assign(new Error("Sellers cannot bid on their own listings."), { status: 403 });
      const minimum = (listing.currentBidPaise ?? listing.startingPricePaise) + (listing.currentBidPaise === null ? 0 : listing.minimumIncrementPaise);
      if (maxPaise < minimum) throw Object.assign(new Error(`Maximum bid must be at least ₹${(minimum / 100).toFixed(2)}.`), { status: 409 });
      const autoBid = await tx.autoBid.upsert({
        where: { listingId_bidderId: { listingId: listing.id, bidderId: req.user.id } },
        create: { listingId: listing.id, bidderId: req.user.id, maxPaise },
        update: { maxPaise, active: true },
      });
      const amountPaise = Math.min(maxPaise, minimum);
      const bid = await tx.bid.create({ data: { listingId: listing.id, bidderId: req.user.id, amountPaise } });
      const extension = listing.auctionEndsAt.getTime() - Date.now() <= 30_000 ? new Date(Date.now() + 60_000) : listing.auctionEndsAt;
      await tx.listing.update({ where: { id: listing.id }, data: { currentBidPaise: amountPaise, auctionEndsAt: extension } });
      return { autoBid, bid, auctionEndsAt: extension };
    });
    req.app.get("io")?.to(`auction:${req.params.listingId}`).emit("auction:bid", {
      listingId: req.params.listingId,
      amount: result.bid.amountPaise / 100,
      auctionEndsAt: result.auctionEndsAt,
      createdAt: result.bid.createdAt,
    });
    res.status(201).json({ success: true, data: { amount: result.bid.amountPaise / 100, maxAmount: result.autoBid.maxPaise / 100, auctionEndsAt: result.auctionEndsAt } });
  } catch (error) {
    next(error);
  }
});

router.post("/:listingId/bids", requireAuth, requireRole("BUYER"), async (req, res, next) => {
  try {
    const amountPaise = parsePaise(req.body.amount);
    const idempotencyKey = typeof req.get("Idempotency-Key") === "string" ? req.get("Idempotency-Key").slice(0, 100) : null;
    if (!amountPaise || amountPaise <= 0) return res.status(400).json({ code: "INVALID_AMOUNT", message: "Enter a valid positive bid amount." });
    const prisma = await getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: req.params.listingId }, include: { seller: true } });
      if (!listing) throw Object.assign(new Error("Listing not found."), { status: 404, code: "LISTING_NOT_FOUND" });
      if (listing.sellerId === req.user.id) throw Object.assign(new Error("Sellers cannot bid on their own listings."), { status: 403, code: "SELLER_CANNOT_BID" });
      if (listing.status !== "OPEN" || listing.auctionEndsAt.getTime() <= Date.now()) throw Object.assign(new Error("This auction is closed."), { status: 409, code: "AUCTION_CLOSED" });
      const previousBid = listing.currentBidPaise === null
        ? null
        : await tx.bid.findFirst({
          where: { listingId: listing.id },
          orderBy: [{ amountPaise: "desc" }, { createdAt: "asc" }],
          select: { bidderId: true, amountPaise: true },
        });
      const current = listing.currentBidPaise ?? listing.startingPricePaise;
      const minimum = listing.currentBidPaise === null ? current : current + listing.minimumIncrementPaise;
      if (amountPaise < minimum) throw Object.assign(new Error(`Bid must be at least ₹${(minimum / 100).toFixed(2)}.`), { status: 409, code: "BID_TOO_LOW" });
      if (idempotencyKey) {
        const duplicate = await tx.bid.findFirst({ where: { bidderId: req.user.id, idempotencyKey } });
        if (duplicate) return { bid: duplicate, duplicate: true };
      }
      const bid = await tx.bid.create({ data: { listingId: listing.id, bidderId: req.user.id, amountPaise, idempotencyKey } });
      const extension = listing.auctionEndsAt.getTime() - Date.now() <= 30_000 ? new Date(Date.now() + 60_000) : listing.auctionEndsAt;
      await tx.listing.update({ where: { id: listing.id }, data: { currentBidPaise: amountPaise, auctionEndsAt: extension } });
      await tx.notification.create({
        data: {
          userId: listing.sellerId,
          type: "SYSTEM",
          entityId: listing.id,
          title: "New bid received",
          message: `A buyer placed a bid of ₹${(amountPaise / 100).toFixed(2)} on ${listing.title}.`,
          dedupeKey: `bid:seller:${bid.id}`,
        },
      });
      if (previousBid && previousBid.bidderId !== req.user.id) {
        await tx.notification.create({
          data: {
            userId: previousBid.bidderId,
            type: "OUTBID",
            entityId: listing.id,
            title: "You were outbid",
            message: `A higher bid was placed on ${listing.title}.`,
            dedupeKey: `bid:outbid:${bid.id}:${previousBid.bidderId}`,
          },
        });
      }
      let automaticBid = null;
      let automaticAmount = amountPaise;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const competingAutoBid = await tx.autoBid.findFirst({
          where: { listingId: listing.id, bidderId: { not: automaticBid?.bidderId ?? req.user.id }, active: true, maxPaise: { gte: automaticAmount + listing.minimumIncrementPaise } },
          orderBy: [{ maxPaise: "desc" }, { createdAt: "asc" }],
        });
        if (!competingAutoBid) break;
        automaticAmount = Math.min(competingAutoBid.maxPaise, automaticAmount + listing.minimumIncrementPaise);
        automaticBid = await tx.bid.create({ data: { listingId: listing.id, bidderId: competingAutoBid.bidderId, amountPaise: automaticAmount } });
        await tx.listing.update({ where: { id: listing.id }, data: { currentBidPaise: automaticAmount } });
      }
      return { bid, automaticBid, sellerId: listing.sellerId, outbidUserId: previousBid?.bidderId, auctionEndsAt: extension, duplicate: false };
    });
    if (!result.duplicate) {
      req.app.get("io")?.to(`auction:${req.params.listingId}`).emit("auction:bid", {
        listingId: req.params.listingId,
        amount: result.bid.amountPaise / 100,
        auctionEndsAt: result.auctionEndsAt,
        createdAt: result.bid.createdAt,
      });
      if (result.automaticBid) {
        req.app.get("io")?.to(`auction:${req.params.listingId}`).emit("auction:bid", {
          listingId: req.params.listingId,
          amount: result.automaticBid.amountPaise / 100,
          auctionEndsAt: result.auctionEndsAt,
          createdAt: result.automaticBid.createdAt,
          automatic: true,
        });
      }
      req.app.get("io")?.to(`user:${result.sellerId}`).emit("notification:new", {
        type: "SYSTEM",
        title: "New bid received",
        listingId: req.params.listingId,
      });
      if (result.outbidUserId) {
        req.app.get("io")?.to(`user:${result.outbidUserId}`).emit("notification:new", {
          type: "OUTBID",
          title: "You were outbid",
          listingId: req.params.listingId,
        });
      }
    }
    res.status(result.duplicate ? 200 : 201).json({ success: true, duplicate: result.duplicate, data: { id: result.bid.id, amount: result.bid.amountPaise / 100, auctionEndsAt: result.auctionEndsAt, createdAt: result.bid.createdAt } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
