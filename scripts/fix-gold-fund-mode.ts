import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.product.update({
    where: { ticker: 'SGF-IAU' },
    data: {
      price_mode: 'automated',
      price_source: 'yahoo-finance'
    }
  });
  console.log("Updated SGF-IAU to automated and yahoo-finance");
}

main().catch(console.error).finally(() => prisma.$disconnect());
