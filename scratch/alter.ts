import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe("ALTER TABLE SecurityTransaction ADD COLUMN symbol TEXT;");
  console.log("Column added");
}
main().catch(console.error).finally(() => prisma.$disconnect());
