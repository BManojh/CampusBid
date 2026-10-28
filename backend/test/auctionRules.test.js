const test = require("node:test");
const assert = require("node:assert/strict");
const { canBid, minimumBidPaise, parsePaise } = require("../services/auctionRules");

test("parses rupee values into integer paise", () => {
  assert.equal(parsePaise("500.50"), 50050);
  assert.equal(parsePaise("500"), 50000);
  assert.equal(parsePaise("5.123"), null);
});

test("minimum bid uses starting price before the first bid", () => {
  assert.equal(minimumBidPaise(50000, null, 5000), 50000);
  assert.equal(minimumBidPaise(50000, 55000, 5000), 60000);
});

test("rejects sellers and expired auctions", () => {
  assert.equal(canBid({ status: "OPEN", auctionEndsAt: Date.now() + 1000, bidderId: "seller", sellerId: "seller", amountPaise: 100, startingPricePaise: 100, currentBidPaise: null, minimumIncrementPaise: 10 }).code, "SELLER_CANNOT_BID");
  assert.equal(canBid({ status: "OPEN", auctionEndsAt: Date.now() - 1000, bidderId: "buyer", sellerId: "seller", amountPaise: 100, startingPricePaise: 100, currentBidPaise: null, minimumIncrementPaise: 10 }).code, "AUCTION_CLOSED");
});

test("accepts a valid manual bid", () => {
  assert.deepEqual(canBid({ status: "OPEN", auctionEndsAt: Date.now() + 1000, bidderId: "buyer", sellerId: "seller", amountPaise: 60000, startingPricePaise: 50000, currentBidPaise: 55000, minimumIncrementPaise: 5000 }), { valid: true, minimum: 60000 });
});
