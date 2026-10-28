const express = require("express");
const { getPrisma } = require("../db");

const router = express.Router();

function toListingResponse(listing) {
  return {
    id: listing.id,
    title: listing.title,
    category: listing.category,
    description: listing.description,
    condition: listing.condition,
    startingPrice: listing.startingPricePaise / 100,
    currentBid: (listing.currentBidPaise ?? listing.startingPricePaise) / 100,
    minimumIncrement: listing.minimumIncrementPaise / 100,
    auctionEndsAt: listing.auctionEndsAt,
    status: listing.status,
    bids: listing._count?.bids ?? 0,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const listings = await prisma.listing.findMany({
      where: { status: "OPEN" },
      orderBy: { auctionEndsAt: "asc" },
      include: { _count: { select: { bids: true } } },
    });

    res.status(200).json({
      success: true,
      count: listings.length,
      data: listings.map(toListingResponse),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
