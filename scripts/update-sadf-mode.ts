import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.product.update({
    where: { ticker: 'SADF' },
    data: { price_mode: 'automated', price_source: 'Bloomberg runs' }
  });
  console.log('Updated SADF mode/source');
}

main().finally(() => prisma.$disconnect());
