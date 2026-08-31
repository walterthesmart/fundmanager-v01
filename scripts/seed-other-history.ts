import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    where: {
      ticker: { not: "SGF-IAU" } // Skip Gold Fund, it already has real data
    }
  });

  const now = new Date();
  const DAYS = 100;
  
  for (const product of products) {
    let currentPrice = product.price * 0.8; // Start 20% lower 100 days ago
    
    // Check if it already has history
    const existing = await prisma.priceHistory.count({
      where: { product_id: product.id }
    });
    
    if (existing > 0) {
      console.log(`Skipping ${product.name}, already has history.`);
      continue;
    }
    
    let inserted = 0;
    for (let i = DAYS; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Random walk
      const change = (Math.random() - 0.45) * 0.02; // slight upward bias
      const oldPrice = currentPrice;
      currentPrice = currentPrice * (1 + change);
      
      if (i === 0) {
        currentPrice = product.price; // match exact current price on last day
      }
      
      await prisma.priceHistory.create({
        data: {
          product_id: product.id,
          old_price: oldPrice,
          new_price: currentPrice,
          mode: "manual",
          source: "mock-data",
          occurred_at: date,
        }
      });
      inserted++;
    }
    console.log(`Seeded ${inserted} history records for ${product.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
