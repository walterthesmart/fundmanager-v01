const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { name: { contains: 'Guaranteed Income Fund' } }
  });
  if (product) {
    console.log("Found product:", product.name, "Currency:", product.currency);
    await prisma.product.update({
      where: { id: product.id },
      data: { cash_balance: 784218515.20 }
    });
    console.log("Updated cash balance to 784,218,515.20");
  } else {
    console.log("Product not found");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
