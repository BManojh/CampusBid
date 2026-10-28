
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const healthRoutes = require("./routes/healthRoutes");
const listingRoutes = require("./routes/listingRoutes");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const discoveryRoutes = require("./routes/discoveryRoutes");
const { configureSocket } = require("./services/socketService");
const { startAuctionWorker } = require("./services/auctionWorker");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:5173" },
});
configureSocket(io);
app.set("io", io);
// Allow Express to read JSON request bodies.
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "1d",
  index: false,
}));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/health-check", healthRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api", discoveryRoutes);

// Basic API health-check endpoint.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CampusBid backend is running!",
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("API error:", error.message);
  res.status(error.status || 500).json({
    code: error.code || "INTERNAL_ERROR",
    message: error.status ? error.message : "Something went wrong. Please try again.",
  });
});

// Start the server.
httpServer.listen(PORT, () => {
  console.log(`CampusBid backend running at http://localhost:${PORT}`);
  startAuctionWorker();
});
