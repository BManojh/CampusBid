const jwt = require("jsonwebtoken");
const { getPrisma } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "campusbid-local-development-secret";

function effectiveRole(role) {
  return role === "STUDENT" ? "BUYER" : role;
}

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication is required." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, accountStatus: true },
    });

    if (!user) {
      return res.status(401).json({ message: "The account could not be found." });
    }
    if (user.accountStatus !== "ACTIVE") {
      return res.status(403).json({ message: "This account is currently suspended." });
    }

    req.user = { ...user, role: effectiveRole(user.role) };
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Your session has expired. Please log in again." });
    }
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(effectiveRole(req.user.role))) {
      return res.status(403).json({ message: "You do not have permission for this action." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, effectiveRole };
