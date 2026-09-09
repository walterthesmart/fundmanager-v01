const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.instrument.count();
  console.log("Instrument count:", count);
}
main().catch(console.error).finally(() => prisma.$disconnect());
