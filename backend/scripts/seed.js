const { getPrisma } = require("../db");

async function seed() {
  const prisma = await getPrisma();
  const seller = await prisma.user.upsert({
    where: { email: "seller@campusbid.local" },
    update: {},
    create: {
      name: "CampusBid Demo Seller",
      email: "seller@campusbid.local",
      role: "SELLER",
      passwordHash: "development-only-placeholder",
    },
  });

  const listings = [
    {
      title: "Engineering Calculator",
      category: "Calculators",
      description: "A reliable scientific calculator for engineering coursework.",
      condition: "Good",
      startingPricePaise: 50000,
      minimumIncrementPaise: 5000,
      currentBidPaise: 50000,
    },
    {
      title: "Data Structures Textbook",
      category: "Books",
      description: "A well-kept textbook for data structures and algorithms.",
      condition: "Like New",
      startingPricePaise: 25000,
      minimumIncrementPaise: 2500,
      currentBidPaise: 25000,
    },
  ];

  for (const listing of listings) {
    await prisma.listing.upsert({
      where: {
        id: `${seller.id}-${listing.title.toLowerCase().replaceAll(" ", "-")}`,
      },
      update: listing,
      create: {
        id: `${seller.id}-${listing.title.toLowerCase().replaceAll(" ", "-")}`,
        sellerId: seller.id,
        auctionEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ...listing,
      },
    });
  }

  await prisma.$disconnect();
  console.log("Seeded development seller and listings.");
}

seed().catch(async (error) => {
  console.error("Database seed failed:", error);
  const prisma = await getPrisma();
  await prisma.$disconnect();
  process.exitCode = 1;
});
