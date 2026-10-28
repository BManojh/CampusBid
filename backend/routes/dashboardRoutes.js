const express = require("express");
const { getPrisma } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const [bids, listings, transactions, notifications] = await Promise.all([
      prisma.bid.findMany({
        where: { bidderId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { listing: { select: { id: true, title: true, status: true, auctionEndsAt: true } } },
      }),
      prisma.listing.findMany({
        where: { sellerId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { _count: { select: { bids: true } } },
      }),
      prisma.transaction.findMany({
        where: { OR: [{ buyerId: req.user.id }, { sellerId: req.user.id }] },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { listing: { select: { id: true, title: true } } },
      }),
      prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
    ]);
    res.json({
      success: true,
      data: {
        bids: ["BUYER", "STUDENT"].includes(req.user.role) ? bids : [],
        listings: req.user.role === "SELLER" ? listings : [],
        transactions,
        unreadNotifications: notifications,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
