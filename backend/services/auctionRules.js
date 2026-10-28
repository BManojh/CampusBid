function parsePaise(value) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const paise = Number(`${whole}${fraction.padEnd(2, "0")}`);
  return Number.isSafeInteger(paise) ? paise : null;
}

function minimumBidPaise(startingPricePaise, currentBidPaise, minimumIncrementPaise) {
  return currentBidPaise === null
    ? startingPricePaise
    : currentBidPaise + minimumIncrementPaise;
}

function canBid({ status, auctionEndsAt, bidderId, sellerId, amountPaise, startingPricePaise, currentBidPaise, minimumIncrementPaise, now = Date.now() }) {
  if (status !== "OPEN") return { valid: false, code: "AUCTION_CLOSED" };
  if (new Date(auctionEndsAt).getTime() <= now) return { valid: false, code: "AUCTION_CLOSED" };
  if (bidderId === sellerId) return { valid: false, code: "SELLER_CANNOT_BID" };
  const minimum = minimumBidPaise(startingPricePaise, currentBidPaise, minimumIncrementPaise);
  if (amountPaise < minimum) return { valid: false, code: "BID_TOO_LOW", minimum };
  return { valid: true, minimum };
}

module.exports = { parsePaise, minimumBidPaise, canBid };
