const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const history = await prisma.priceHistory.findMany({
     take: 5
  });
  console.log("PriceHistory:", history);
}
main().catch(console.error).finally(() => prisma.$disconnect());
