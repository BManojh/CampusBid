
const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/healthRoutes");
const listingRoutes = require("./routes/listingRoutes");

const app = express();
const PORT = 5000;
// Allow Express to read JSON request bodies.
app.use(express.json());
app.use(cors());
app.use("/api/health-check", healthRoutes);
app.use("/api/listings", listingRoutes);

// Basic API health-check endpoint.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CampusBid backend is running!",
  });
});

// Start the server.
app.listen(PORT, () => {
  console.log(`CampusBid backend running at http://localhost:${PORT}`);
});
