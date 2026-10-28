const express = require("express");
const { getPrisma } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, accountStatus: true, createdAt: true },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    if (typeof req.body.name !== "string" || req.body.name.trim().length < 2) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Name must be at least 2 characters." });
    }
    const prisma = await getPrisma();
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: req.body.name.trim() },
      select: { id: true, name: true, email: true, role: true, accountStatus: true },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
