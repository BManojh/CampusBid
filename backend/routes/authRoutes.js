const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const { getPrisma } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "campusbid-local-development-secret";

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
  };
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "2h",
  });
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role = "BUYER" } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      typeof password !== "string" ||
      password.length < 8 ||
      !["BUYER", "SELLER"].includes(role)
    ) {
      return res.status(400).json({
        message: "Enter a valid name, email, and password of at least 8 characters.",
      });
    }

    const prisma = await getPrisma();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

      const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
          role,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });

    return res.status(201).json({
      user: publicUser(user),
      token: issueToken(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    if (user.accountStatus !== "ACTIVE") {
      return res.status(403).json({ message: "This account is currently suspended." });
    }

    return res.status(200).json({
      user: publicUser(user),
      token: issueToken(user),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

router.post("/logout", requireAuth, (req, res) => {
  res.status(200).json({ success: true, message: "Signed out successfully." });
});

module.exports = router;
