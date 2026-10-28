const express = require("express");
const { getPrisma } = require("../db");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));

router.get("/overview", async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const [users, openListings, pendingTransactions, auditLogs] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count({ where: { status: "OPEN" } }),
      prisma.transaction.count({ where: { sellerDecision: "PENDING" } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { actor: { select: { name: true, email: true } } } }),
    ]);
    res.json({ success: true, data: { users, openListings, pendingTransactions, auditLogs } });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, accountStatus: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:userId/status", async (req, res, next) => {
  try {
    if (!["ACTIVE", "SUSPENDED"].includes(req.body.status)) {
      return res.status(400).json({ message: "Status must be ACTIVE or SUSPENDED." });
    }
    if (req.params.userId === req.user.id) return res.status(400).json({ message: "You cannot suspend your own account." });
    const prisma = await getPrisma();
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { accountStatus: req.body.status },
      select: { id: true, name: true, email: true, role: true, accountStatus: true },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: `ACCOUNT_${req.body.status}`, entityType: "USER", entityId: user.id, reason: req.body.reason?.trim() || null },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.patch("/listings/:listingId/cancel", async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const listing = await prisma.listing.update({
      where: { id: req.params.listingId },
      data: { status: "CANCELLED" },
      select: { id: true, title: true, status: true },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: "LISTING_CANCELLED", entityType: "LISTING", entityId: listing.id, reason: req.body.reason?.trim() || "Administrative moderation" },
    });
    res.json({ success: true, data: listing });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
