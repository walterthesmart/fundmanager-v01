const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearEquityTxns() {
  try {
    const products = await prisma.product.findMany({
      where: {
        asset_class: {
          in: ['global_equity', 'local_equity']
        }
      }
    });

    for (const product of products) {
      const deletedSec = await prisma.securityTransaction.deleteMany({
        where: { product_id: product.id }
      });
      const deletedCash = await prisma.cashTransaction.deleteMany({
        where: { product_id: product.id, source_name: 'Equity Import' }
      });
      console.log(`Cleared for ${product.name}: ${deletedSec.count} security txns, ${deletedCash.count} cash txns`);
    }
  } catch (error) {
    console.error('Error clearing txns:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearEquityTxns();
