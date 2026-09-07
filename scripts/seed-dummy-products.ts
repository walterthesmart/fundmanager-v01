import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const dummyProducts = [
    {
      name: "Sankore Global Equity Fund",
      ticker: "SGEF-MCB",
      asset_class: "global_equity",
      price: 142.50,
      previous_price: 141.20,
      price_mode: "automated",
      price_source: "yahoo-finance",
    },
    {
      name: "Sankore Local Equity Fund",
      ticker: "SGF-LOC",
      asset_class: "local_equity",
      price: 89.20,
      previous_price: 90.10,
      price_mode: "manual",
    },
    {
      name: "Sankore Fixed Income Fund",
      ticker: "SGF-FIX",
      asset_class: "fixed_income",
      price: 105.10,
      previous_price: 105.00,
      price_mode: "manual",
    },
    {
      name: "Sankore Money Market Fund",
      ticker: "SGF-MMF",
      asset_class: "money_market",
      price: 1.00,
      previous_price: 1.00,
      price_mode: "manual",
    },
    {
      name: "Sankore Real Estate Trust",
      ticker: "SRE-REIT",
      asset_class: "real_estate",
      price: 215.75,
      previous_price: 212.50,
      price_mode: "manual",
    },
  ];

  for (const product of dummyProducts) {
    // upsert based on ticker
    await prisma.product.upsert({
      where: { ticker: product.ticker },
      update: {},
      create: product,
    });
    console.log(`Created dummy product: ${product.name}`);
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
