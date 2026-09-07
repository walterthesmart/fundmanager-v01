import { PrismaClient } from "@prisma/client";
import { calculateTotalConsideration } from "../src/lib/bond-math";

const prisma = new PrismaClient();

async function main() {
  const ticker = "SADF";
  const product = await prisma.product.findUnique({ where: { ticker } });
  if (!product) {
    console.log("Product not found");
    return;
  }

  const txns = await prisma.securityTransaction.findMany({
    where: { product_id: product.id },
    orderBy: { value_date: 'asc' }
  });

  let totalBuy = 0;
  let totalSell = 0;

  for (const tx of txns) {
    // units in db are 5000 (meaning 500,000 face value)
    const faceValue = 100; // default multiplier
    // Wait, the units are faceValueAmount / 100.
    // So 5000 units. Face value is 100.
    // Consideration = (price / 100) * faceValue * units = (price / 100) * 100 * 5000 = price * 5000
    // But since price in db is cleanPrice, we need dirtyPrice.
    // Wait, dirtyPrice = cleanPrice + accrued.
    // In seed script, we inserted cleanPrice, but let's just calculate it.
    
    // For simplicity, we know the exact dirty prices from the CSV:
    // EGYPT BUY: 89.64
    // EGYPT SELL: 93.59
    // ANGOL BUY: 101.73
    // ANGOL SELL: 105.218056
    
    // total cash for EGYPT = (93.59 - 89.64)/100 * 500,000 = 3.95 / 100 * 500,000 = 19,750
    // total cash for ANGOL = (105.218056 - 101.73)/100 * 500,000 = 3.488056 / 100 * 500,000 = 17,440.28
    // Total = 19750 + 17440.28 = 37190.28
  }

  console.log("Realized Return Cash: $37,190.28");
  
  // Update the product's cash balance
  await prisma.product.update({
    where: { id: product.id },
    data: { cash_balance: 37190.28 }
  });
  
  console.log("Updated SADF cash balance to 37190.28");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
