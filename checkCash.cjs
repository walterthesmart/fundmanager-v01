const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const cashTxs = await prisma.cashTransaction.findMany();
  console.log("Cash Txs Count:", cashTxs.length);
  if (cashTxs.length > 0) {
      console.log(cashTxs.slice(0, 5));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
