import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // These are the EXACT original products from the Supabase migration:
  // supabase/migrations/20260806232251_88079b0f-9291-46b5-ae6d-3e5b471e7450.sql
  //
  // NOTE: The old Supabase schema used 'equities' not 'global_equity'/'local_equity'.
  // We map them into the new split asset classes.
  const originalProducts = [
    // ── Equities → split into Global and Local ──
    { name: "Sankore Nigerian Equity Fund", ticker: "SNK-EQF", asset_class: "local_equity", price: 142.55, previous_price: 140.12, price_mode: "automated", price_source: "NGX Market Feed" },
    { name: "Pan-African Growth Equities", ticker: "PAF-GRW", asset_class: "global_equity", price: 88.40, previous_price: 89.95, price_mode: "automated", price_source: "Refinitiv" },
    { name: "Dangote Cement Plc", ticker: "DANGCEM", asset_class: "local_equity", price: 31.20, previous_price: 30.45, price_mode: "manual" },
    { name: "GTCO Holdings", ticker: "GTCO", asset_class: "local_equity", price: 2.98, previous_price: 2.87, price_mode: "automated", price_source: "NGX Market Feed" },

    // ── Fixed Income → split into Local and Global ──
    { name: "FGN Bond 2031 Series", ticker: "FGN-2031", asset_class: "local_fixed_income", price: 101.85, previous_price: 101.40, price_mode: "manual" },
    { name: "Sankore Eurobond Fund", ticker: "SNK-EURO", asset_class: "global_fixed_income", price: 119.75, previous_price: 119.90, price_mode: "automated", price_source: "Bloomberg" },
    { name: "Corporate Credit Note 2028", ticker: "CCN-2028", asset_class: "local_fixed_income", price: 97.30, previous_price: 97.30, price_mode: "manual" },

    // ── Money Market ──
    { name: "Sankore Treasury Bill Fund", ticker: "SNK-TBF", asset_class: "money_market", price: 1.045, previous_price: 1.043, price_mode: "automated", price_source: "CBN OMO Rates" },
    { name: "Naira Liquidity Fund", ticker: "NLF-MMF", asset_class: "money_market", price: 1.012, previous_price: 1.011, price_mode: "automated", price_source: "CBN OMO Rates" },

    // ── Real Estate ──
    { name: "Lagos Prime Real Estate Trust", ticker: "LPR-REIT", asset_class: "real_estate", price: 56.90, previous_price: 55.25, price_mode: "manual" },
    { name: "Accra Commercial Property Fund", ticker: "ACC-PROP", asset_class: "real_estate", price: 44.15, previous_price: 44.80, price_mode: "manual" },

    // ── Alternatives ──
    { name: "Sankore Private Credit I", ticker: "SNK-PC1", asset_class: "alternatives", price: 1120.00, previous_price: 1098.00, price_mode: "manual" },
    { name: "West Africa Infrastructure SPV", ticker: "WAI-SPV", asset_class: "alternatives", price: 805.50, previous_price: 805.50, price_mode: "manual" },
    { name: "Global Commodity Basket", ticker: "GLB-COM", asset_class: "alternatives", price: 212.40, previous_price: 208.90, price_mode: "automated", price_source: "ICE Data Services" },
  ];

  let created = 0;
  let skipped = 0;
  for (const product of originalProducts) {
    const existing = await prisma.product.findUnique({ where: { ticker: product.ticker } });
    if (existing) {
      console.log(`  SKIP (exists): ${product.ticker} - ${product.name}`);
      skipped++;
    } else {
      await prisma.product.create({ data: product });
      console.log(`  NEW:  ${product.ticker} - ${product.name} → ${product.asset_class}`);
      created++;
    }
  }

  // List final state
  const all = await prisma.product.findMany({ orderBy: [{ asset_class: "asc" }, { name: "asc" }] });
  console.log(`\nCreated ${created}, skipped ${skipped}. Total products in DB: ${all.length}\n`);

  let lastClass = "";
  for (const p of all) {
    if (p.asset_class !== lastClass) {
      lastClass = p.asset_class;
      console.log(`\n── ${lastClass} ──`);
    }
    console.log(`  ${p.ticker.padEnd(12)} ${p.name}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
