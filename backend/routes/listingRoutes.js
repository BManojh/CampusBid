
const express = require("express");

const router = express.Router();

// Temporary sample listings for API development.
const listings = [
  {
    id: 1,
    title: "Engineering Calculator",
    category: "Calculators",
    startingPrice: 500,
    currentBid: 500,
    condition: "Good",
  },
  {
    id: 2,
    title: "Data Structures Textbook",
    category: "Books",
    startingPrice: 250,
    currentBid: 250,
    condition: "Like New",
  },
];

// GET /api/listings
// Return all sample listings.
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    count: listings.length,
    data: listings,
  });
});

module.exports = router;
