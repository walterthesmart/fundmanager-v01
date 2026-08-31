import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const history = await prisma.priceHistory.findMany({
    where: { product: { ticker: "SGF-IAU" } },
    orderBy: { occurred_at: 'asc' }
  });
  console.log(`Found ${history.length} records`);
  if (history.length > 0) {
    console.log("First 5:", history.slice(0, 5));
    console.log("Last 5:", history.slice(-5));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
