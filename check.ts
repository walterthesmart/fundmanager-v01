import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.instrument.findMany({ where: { symbol: { in: ['FGN 2035 BOND'] } } })
  .then(console.log)
  .finally(() => prisma.$disconnect());
