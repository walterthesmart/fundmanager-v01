import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.product.update({
    where: { ticker: 'SADF' },
    data: { cash_balance: 0 }
  });
  console.log('Reset cash_balance to 0');
}

main().finally(() => prisma.$disconnect());
