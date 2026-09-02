import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const instruments = await prisma.instrument.findMany();
  console.log(instruments);
}
run();
