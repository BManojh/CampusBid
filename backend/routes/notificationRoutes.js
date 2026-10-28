const express = require("express");
const { getPrisma } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = notifications.filter((notification) => !notification.readAt).length;
    res.json({ success: true, unread, data: notifications });
  } catch (error) {
    next(error);
  }
});

router.patch("/:notificationId/read", requireAuth, async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const result = await prisma.notification.updateMany({
      where: { id: req.params.notificationId, userId: req.user.id },
      data: { readAt: new Date() },
    });
    if (!result.count) return res.status(404).json({ message: "Notification not found." });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch("/read-all", requireAuth, async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
