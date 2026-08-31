import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Update existing fixed income product to local_fixed_income
  await prisma.product.updateMany({
    where: { asset_class: "fixed_income" },
    data: { asset_class: "local_fixed_income" },
  });
  console.log("Migrated existing fixed_income products to local_fixed_income");

  // 2. Add new sample products across all asset classes
  const newProducts = [
    // Global Equity
    {
      name: "Sankore S&P 500 Tracker",
      ticker: "SGF-SPY",
      asset_class: "global_equity",
      price: 528.40,
      previous_price: 525.10,
      price_mode: "automated",
      price_source: "yahoo-finance",
    },
    {
      name: "Sankore MSCI World Fund",
      ticker: "SGF-MSCI",
      asset_class: "global_equity",
      price: 112.85,
      previous_price: 111.90,
      price_mode: "manual",
    },

    // Local Equity
    {
      name: "Sankore NGX 30 Tracker",
      ticker: "SGF-NGX30",
      asset_class: "local_equity",
      price: 74.60,
      previous_price: 73.85,
      price_mode: "manual",
    },
    {
      name: "Sankore Banking Sector Fund",
      ticker: "SGF-BANK",
      asset_class: "local_equity",
      price: 45.20,
      previous_price: 44.80,
      price_mode: "manual",
    },

    // Global Fixed Income
    {
      name: "Sankore US Treasury Bond Fund",
      ticker: "SGF-USTB",
      asset_class: "global_fixed_income",
      price: 98.50,
      previous_price: 98.45,
      price_mode: "manual",
    },
    {
      name: "Sankore Global Corporate Bond Fund",
      ticker: "SGF-GCBF",
      asset_class: "global_fixed_income",
      price: 101.25,
      previous_price: 101.10,
      price_mode: "manual",
    },

    // Local Fixed Income (SGF-FIX already exists, add another)
    {
      name: "Sankore FGN Bond Fund",
      ticker: "SGF-FGNB",
      asset_class: "local_fixed_income",
      price: 103.80,
      previous_price: 103.60,
      price_mode: "manual",
    },

    // Money Market (SGF-MMF already exists, add another)
    {
      name: "Sankore Dollar Money Market Fund",
      ticker: "SGF-DMMF",
      asset_class: "money_market",
      price: 1.00,
      previous_price: 1.00,
      price_mode: "manual",
    },

    // Real Estate (SRE-REIT already exists, add another)
    {
      name: "Sankore Commercial Property Fund",
      ticker: "SRE-CPF",
      asset_class: "real_estate",
      price: 180.50,
      previous_price: 178.25,
      price_mode: "manual",
    },

    // Alternatives (SGF-IAU already exists, add another)
    {
      name: "Sankore Digital Assets Fund",
      ticker: "SGF-DIGI",
      asset_class: "alternatives",
      price: 320.00,
      previous_price: 315.50,
      price_mode: "manual",
    },
  ];

  for (const product of newProducts) {
    await prisma.product.upsert({
      where: { ticker: product.ticker },
      update: {},
      create: product,
    });
    console.log(`Upserted: ${product.name} (${product.ticker}) → ${product.asset_class}`);
  }

  // List final state
  const all = await prisma.product.findMany({ orderBy: { asset_class: "asc" } });
  console.log(`\nTotal products: ${all.length}`);
  all.forEach(p => console.log(`  ${p.asset_class.padEnd(22)} | ${p.ticker.padEnd(10)} | ${p.name}`));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
