import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const tx = await prisma.securityTransaction.findMany({
    where: { product: { ticker: "GIF($)" } },
    take: 2,
    orderBy: { created_at: 'desc' }
  });
  console.log(JSON.stringify(tx, null, 2));
}
main().finally(() => prisma.$disconnect());
