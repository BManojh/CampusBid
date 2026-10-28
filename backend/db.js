require("dotenv").config();

let prismaPromise;

async function getPrisma() {
  if (!prismaPromise) {
    prismaPromise = Promise.all([
      import("@prisma/adapter-pg"),
      import("./generated/prisma/client.ts"),
    ]).then(([{ PrismaPg }, generatedClient]) => {
      const { PrismaClient } = generatedClient.default;
      const adapter = new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      });

      return new PrismaClient({ adapter });
    });
  }

  return prismaPromise;
}

module.exports = { getPrisma };
