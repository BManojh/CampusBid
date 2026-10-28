const express = require("express");
const { getPrisma } = require("../db");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

function parsePaise(value) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const paise = Number(`${whole}${fraction.padEnd(2, "0")}`);
  return Number.isSafeInteger(paise) ? paise : null;
}

router.get("/listings/:listingId/questions", async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const questions = await prisma.question.findMany({
      where: { listingId: req.params.listingId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: questions });
  } catch (error) {
    next(error);
  }
});

router.post("/listings/:listingId/questions", requireAuth, requireRole("BUYER", "SELLER", "ADMIN"), async (req, res, next) => {
  try {
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    if (body.length < 5 || body.length > 500) return res.status(400).json({ message: "Question must be between 5 and 500 characters." });
    const prisma = await getPrisma();
    const listing = await prisma.listing.findUnique({ where: { id: req.params.listingId }, select: { id: true, sellerId: true, title: true } });
    if (!listing) return res.status(404).json({ message: "Listing not found." });
    const question = await prisma.question.create({ data: { listingId: listing.id, authorId: req.user.id, body }, include: { author: { select: { id: true, name: true } } } });
    if (req.user.id !== listing.sellerId) {
      await prisma.notification.create({
        data: {
          userId: listing.sellerId,
          type: "SYSTEM",
          entityId: listing.id,
          title: "New question on your listing",
          message: `A buyer asked a question about ${listing.title}.`,
          dedupeKey: `question:${question.id}`,
        },
      });
    }
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.patch("/questions/:questionId", requireAuth, requireRole("SELLER", "ADMIN"), async (req, res, next) => {
  try {
    const answer = typeof req.body.answer === "string" ? req.body.answer.trim() : "";
    if (answer.length < 2 || answer.length > 1000) return res.status(400).json({ message: "Answer must be between 2 and 1000 characters." });
    const prisma = await getPrisma();
    const question = await prisma.question.findUnique({ where: { id: req.params.questionId }, include: { listing: { select: { sellerId: true, title: true } } } });
    if (!question || (req.user.role !== "ADMIN" && question.listing.sellerId !== req.user.id)) return res.status(404).json({ message: "Question not found." });
    const updated = await prisma.question.update({ where: { id: question.id }, data: { answer, answeredAt: new Date() }, include: { author: { select: { id: true, name: true } } } });
    await prisma.notification.create({
      data: {
        userId: question.authorId,
        type: "SYSTEM",
        entityId: question.listingId,
        title: "Your listing question was answered",
        message: `The seller answered your question about ${question.listing.title}.`,
        dedupeKey: `answer:${question.id}:${updated.answeredAt.toISOString()}`,
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.get("/saved-searches", requireAuth, requireRole("BUYER"), async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const data = await prisma.savedSearch.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/saved-searches", requireAuth, requireRole("BUYER"), async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const query = typeof req.body.query === "string" ? req.body.query.trim() : null;
    const category = typeof req.body.category === "string" ? req.body.category : null;
    const maxPricePaise = req.body.maxPrice == null || req.body.maxPrice === "" ? null : parsePaise(req.body.maxPrice);
    if (name.length < 2 || name.length > 80 || (maxPricePaise !== null && (!maxPricePaise || maxPricePaise <= 0))) {
      return res.status(400).json({ message: "Enter a search name and a valid maximum price." });
    }
    const prisma = await getPrisma();
    const data = await prisma.savedSearch.create({ data: { userId: req.user.id, name, query, category, maxPricePaise } });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete("/saved-searches/:id", requireAuth, requireRole("BUYER"), async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const deleted = await prisma.savedSearch.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!deleted.count) return res.status(404).json({ message: "Saved search not found." });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
