const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const txs = await prisma.securityTransaction.findMany({
    where: { symbol: { contains: '7/Nov/2024' } },
    orderBy: { value_date: 'asc' }
  });
  console.log(txs.map(t => ({
    symbol: t.symbol,
    direction: t.direction,
    units: Number(t.units).toLocaleString(),
    price: Number(t.price).toLocaleString(),
    date: t.value_date
  })));
}

run().catch(console.error).finally(() => prisma.$disconnect());
