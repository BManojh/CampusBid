const express = require("express");
const { getPrisma } = require("../db");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const where = req.user.role === "SELLER" ? { sellerId: req.user.id } : { buyerId: req.user.id };
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { listing: { select: { id: true, title: true, auctionEndsAt: true } } },
    });
    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
});

router.patch("/:transactionId/decision", requireAuth, requireRole("SELLER"), async (req, res, next) => {
  try {
    if (!["ACCEPTED", "REJECTED"].includes(req.body.decision)) {
      return res.status(400).json({ message: "Decision must be ACCEPTED or REJECTED." });
    }
    const prisma = await getPrisma();
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.transactionId } });
    if (!transaction || transaction.sellerId !== req.user.id) return res.status(404).json({ message: "Transaction not found." });
    if (transaction.sellerDecision !== "PENDING" || transaction.status !== "PENDING") {
      return res.status(409).json({ message: "This transaction has already been decided." });
    }
    const nextStatus = req.body.decision === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.transaction.updateMany({
        where: { id: transaction.id, sellerDecision: "PENDING", status: "PENDING" },
        data: { sellerDecision: req.body.decision, sellerResponseAt: new Date(), status: nextStatus },
      });
      if (!result.count) throw Object.assign(new Error("This transaction was already decided."), { status: 409 });
      await tx.notification.create({
        data: {
          userId: transaction.buyerId,
          type: "SELLER_DECISION",
          entityId: transaction.id,
          title: `Seller ${req.body.decision.toLowerCase()} your auction`,
          message: req.body.decision === "ACCEPTED" ? "The seller accepted your winning bid." : "The seller rejected the winning bid.",
          dedupeKey: `decision:${transaction.id}:${req.body.decision}`,
        },
      });
      return tx.transaction.findUnique({ where: { id: transaction.id } });
    });
    req.app.get("io")?.to(`user:${transaction.buyerId}`).emit("notification:new", {
      type: "SELLER_DECISION",
      title: `Seller ${req.body.decision.toLowerCase()} your auction`,
      transactionId: transaction.id,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.patch("/:transactionId/handover", requireAuth, async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.transactionId } });
    if (!transaction || (transaction.buyerId !== req.user.id && transaction.sellerId !== req.user.id)) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    if (!["ACCEPTED", "HANDOVER_SCHEDULED"].includes(transaction.status)) {
      return res.status(409).json({ message: "This transaction is not ready for handover." });
    }
    const isSeller = transaction.sellerId === req.user.id;
    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const nextStatus = isSeller && transaction.buyerConfirmedAt
        || !isSeller && transaction.sellerConfirmedAt
        ? "COMPLETED"
        : "HANDOVER_SCHEDULED";
      const result = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          ...(isSeller ? { sellerConfirmedAt: null } : { buyerConfirmedAt: null }),
        },
        data: isSeller
          ? { sellerConfirmedAt: now, status: nextStatus, completedAt: nextStatus === "COMPLETED" ? now : null }
          : { buyerConfirmedAt: now, status: nextStatus, completedAt: nextStatus === "COMPLETED" ? now : null },
      });
      if (!result.count) throw Object.assign(new Error("This handover was already confirmed."), { status: 409 });
      await tx.notification.create({
        data: {
          userId: isSeller ? transaction.buyerId : transaction.sellerId,
          type: "HANDOVER_UPDATE",
          entityId: transaction.id,
          title: nextStatus === "COMPLETED" ? "Transaction completed" : "Handover confirmed",
          message: nextStatus === "COMPLETED"
            ? "Both parties confirmed the handover."
            : `${isSeller ? "The seller" : "The buyer"} confirmed the handover.`,
          dedupeKey: `handover:${transaction.id}:${isSeller ? "seller" : "buyer"}`,
        },
      });
      return tx.transaction.findUnique({ where: { id: transaction.id } });
    });
    req.app.get("io")?.to(`user:${isSeller ? transaction.buyerId : transaction.sellerId}`).emit("notification:new", {
      type: "HANDOVER_UPDATE",
      title: updated.status === "COMPLETED" ? "Transaction completed" : "Handover confirmed",
      transactionId: transaction.id,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
