const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const instruments = await prisma.instrument.findMany({
    where: { symbol: 'NIGTB 15/07/2027' }
  });
  console.log("Instruments:", instruments);

  const transactions = await prisma.securityTransaction.findMany({
    where: { symbol: 'NIGTB 15/07/2027' }
  });
  console.log("Transactions:", transactions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
