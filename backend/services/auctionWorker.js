const { getPrisma } = require("../db");

async function finalizeExpiredAuctions(io) {
  const prisma = await getPrisma();
  const expired = await prisma.listing.findMany({
    where: { status: "OPEN", auctionEndsAt: { lte: new Date() } },
    select: { id: true },
    take: 100,
  });

  for (const candidate of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.listing.updateMany({
          where: { id: candidate.id, status: "OPEN", auctionEndsAt: { lte: new Date() } },
          data: { status: "CLOSED" },
        });
        if (!claimed.count) return;

        const listing = await tx.listing.findUnique({ where: { id: candidate.id } });
        const winningBid = await tx.bid.findFirst({
          where: { listingId: candidate.id },
          orderBy: [{ amountPaise: "desc" }, { createdAt: "asc" }],
        });

        await tx.auctionResult.create({
          data: {
            listingId: candidate.id,
            winningBidId: winningBid?.id,
            winnerId: winningBid?.bidderId,
            hasWinner: Boolean(winningBid),
          },
        });

        if (winningBid) {
          const transaction = await tx.transaction.create({
            data: {
              listingId: candidate.id,
              buyerId: winningBid.bidderId,
              sellerId: listing.sellerId,
              decisionDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
            },
          });
          await tx.notification.create({
            data: {
              userId: listing.sellerId,
              type: "AUCTION_CLOSED",
              entityId: transaction.id,
              title: "Auction closed",
              message: "A winning bid is ready for your decision.",
              dedupeKey: `auction-closed:seller:${candidate.id}`,
            },
          });
          await tx.notification.create({
            data: {
              userId: winningBid.bidderId,
              type: "AUCTION_CLOSED",
              entityId: transaction.id,
              title: "You won an auction",
              message: "Your winning bid is waiting for the seller's decision.",
              dedupeKey: `auction-closed:buyer:${candidate.id}`,
            },
          });
          io?.to(`user:${listing.sellerId}`).emit("notification:new", { type: "AUCTION_CLOSED", title: "Auction closed", transactionId: transaction.id });
          io?.to(`user:${winningBid.bidderId}`).emit("notification:new", { type: "AUCTION_CLOSED", title: "You won an auction", transactionId: transaction.id });
        }
        io?.to(`auction:${candidate.id}`).emit("auction:closed", { listingId: candidate.id, hasWinner: Boolean(winningBid) });
      });
    } catch (error) {
      console.error(`Auction finalization failed for ${candidate.id}:`, error.message);
    }
  }
}

function startAuctionWorker(io) {
  const run = () => finalizeExpiredAuctions(io).catch((error) => console.error("Auction worker failed:", error.message));
  run();
  return setInterval(run, 30_000);
}

module.exports = { finalizeExpiredAuctions, startAuctionWorker };
