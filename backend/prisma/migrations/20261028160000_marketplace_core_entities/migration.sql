CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "SellerDecision" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

ALTER TABLE "User"
  ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Bid"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Bid_bidderId_idempotencyKey_key"
  ON "Bid"("bidderId", "idempotencyKey");

ALTER TABLE "Transaction"
  ADD COLUMN "sellerDecision" "SellerDecision" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "decisionDeadline" TIMESTAMP(3),
  ADD COLUMN "buyerConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "sellerConfirmedAt" TIMESTAMP(3);

ALTER TABLE "Notification"
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

CREATE TABLE "ListingImage" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publicId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingImage_listingId_idx" ON "ListingImage"("listingId");
ALTER TABLE "ListingImage"
  ADD CONSTRAINT "ListingImage_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuctionResult" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "winningBidId" TEXT,
  "winnerId" TEXT,
  "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hasWinner" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "AuctionResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuctionResult_listingId_key" ON "AuctionResult"("listingId");
CREATE UNIQUE INDEX "AuctionResult_winningBidId_key" ON "AuctionResult"("winningBidId");
ALTER TABLE "AuctionResult"
  ADD CONSTRAINT "AuctionResult_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AuctionResult_winningBidId_fkey"
  FOREIGN KEY ("winningBidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AuctionResult_winnerId_fkey"
  FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx"
  ON "AuditLog"("entityType", "entityId", "createdAt");
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
