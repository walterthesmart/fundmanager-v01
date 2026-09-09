import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findFirst({
    where: { name: { contains: 'Guaranteed Income' } }
  });
  if (p) {
    await prisma.product.update({
      where: { id: p.id },
      data: { cash_balance: 750219841.91 }
    });
    console.log('Updated ' + p.name);
  } else {
    console.log('Not found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
