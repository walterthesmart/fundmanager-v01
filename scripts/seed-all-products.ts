import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const allProducts = [
    // ── Global Equity ──
    { name: "Sankore Global Equity Fund", ticker: "SGF-GLO", asset_class: "global_equity", price: 142.50, previous_price: 141.20, price_mode: "manual" },
    { name: "Sankore S&P 500 Tracker", ticker: "SGF-SPY", asset_class: "global_equity", price: 528.40, previous_price: 525.10, price_mode: "automated", price_source: "yahoo-finance" },
    { name: "Sankore MSCI World Fund", ticker: "SGF-MSCI", asset_class: "global_equity", price: 112.85, previous_price: 111.90, price_mode: "manual" },
    { name: "Sankore Nasdaq 100 Tracker", ticker: "SGF-QQQ", asset_class: "global_equity", price: 485.60, previous_price: 481.30, price_mode: "automated", price_source: "yahoo-finance" },
    { name: "Sankore Emerging Markets Fund", ticker: "SGF-EEM", asset_class: "global_equity", price: 42.15, previous_price: 41.80, price_mode: "manual" },
    { name: "Sankore Europe Equity Fund", ticker: "SGF-EURO", asset_class: "global_equity", price: 68.90, previous_price: 68.45, price_mode: "manual" },
    { name: "Sankore Asia Pacific Fund", ticker: "SGF-APAC", asset_class: "global_equity", price: 55.30, previous_price: 54.95, price_mode: "manual" },
    { name: "Sankore Global Dividend Fund", ticker: "SGF-GDIV", asset_class: "global_equity", price: 98.70, previous_price: 98.20, price_mode: "manual" },

    // ── Local Equity ──
    { name: "Sankore Local Equity Fund", ticker: "SGF-LOC", asset_class: "local_equity", price: 89.20, previous_price: 90.10, price_mode: "manual" },
    { name: "Sankore NGX 30 Tracker", ticker: "SGF-NGX30", asset_class: "local_equity", price: 74.60, previous_price: 73.85, price_mode: "manual" },
    { name: "Sankore Banking Sector Fund", ticker: "SGF-BANK", asset_class: "local_equity", price: 45.20, previous_price: 44.80, price_mode: "manual" },
    { name: "Sankore Consumer Goods Fund", ticker: "SGF-FMCG", asset_class: "local_equity", price: 32.50, previous_price: 32.10, price_mode: "manual" },
    { name: "Sankore Industrial Sector Fund", ticker: "SGF-IND", asset_class: "local_equity", price: 28.75, previous_price: 29.00, price_mode: "manual" },
    { name: "Sankore Oil & Gas Fund", ticker: "SGF-ONG", asset_class: "local_equity", price: 61.40, previous_price: 60.25, price_mode: "manual" },
    { name: "Sankore NGX Pension Index Fund", ticker: "SGF-NPEN", asset_class: "local_equity", price: 105.80, previous_price: 105.20, price_mode: "manual" },

    // ── Global Fixed Income ──
    { name: "Sankore US Treasury Bond Fund", ticker: "SGF-USTB", asset_class: "global_fixed_income", price: 98.50, previous_price: 98.45, price_mode: "manual" },
    { name: "Sankore Global Corporate Bond Fund", ticker: "SGF-GCBF", asset_class: "global_fixed_income", price: 101.25, previous_price: 101.10, price_mode: "manual" },
    { name: "Sankore Eurobond Fund", ticker: "SGF-EBND", asset_class: "global_fixed_income", price: 95.40, previous_price: 95.20, price_mode: "manual" },
    { name: "Sankore Global High Yield Fund", ticker: "SGF-GHYF", asset_class: "global_fixed_income", price: 88.60, previous_price: 88.35, price_mode: "manual" },
    { name: "Sankore Emerging Market Debt Fund", ticker: "SGF-EMDF", asset_class: "global_fixed_income", price: 76.30, previous_price: 76.10, price_mode: "manual" },
    { name: "Sankore Investment Grade Bond Fund", ticker: "SGF-IGBF", asset_class: "global_fixed_income", price: 104.15, previous_price: 104.00, price_mode: "manual" },

    // ── Local Fixed Income ──
    { name: "Sankore Fixed Income Fund", ticker: "SGF-FIX", asset_class: "local_fixed_income", price: 105.10, previous_price: 105.00, price_mode: "manual" },
    { name: "Sankore FGN Bond Fund", ticker: "SGF-FGNB", asset_class: "local_fixed_income", price: 103.80, previous_price: 103.60, price_mode: "manual" },
    { name: "Sankore State Government Bond Fund", ticker: "SGF-SGBF", asset_class: "local_fixed_income", price: 99.20, previous_price: 99.05, price_mode: "manual" },
    { name: "Sankore Naira Treasury Bills Fund", ticker: "SGF-NTBF", asset_class: "local_fixed_income", price: 100.45, previous_price: 100.40, price_mode: "manual" },
    { name: "Sankore Corporate Debt Fund", ticker: "SGF-NCDF", asset_class: "local_fixed_income", price: 102.30, previous_price: 102.15, price_mode: "manual" },
    { name: "Sankore Infrastructure Bond Fund", ticker: "SGF-INFB", asset_class: "local_fixed_income", price: 97.85, previous_price: 97.70, price_mode: "manual" },

    // ── Money Market ──
    { name: "Sankore Money Market Fund", ticker: "SGF-MMF", asset_class: "money_market", price: 1.00, previous_price: 1.00, price_mode: "manual" },
    { name: "Sankore Dollar Money Market Fund", ticker: "SGF-DMMF", asset_class: "money_market", price: 1.00, previous_price: 1.00, price_mode: "manual" },
    { name: "Sankore Naira Liquidity Fund", ticker: "SGF-NLF", asset_class: "money_market", price: 1.00, previous_price: 1.00, price_mode: "manual" },
    { name: "Sankore CBN OMO Fund", ticker: "SGF-OMO", asset_class: "money_market", price: 100.12, previous_price: 100.08, price_mode: "manual" },
    { name: "Sankore Overnight Fund", ticker: "SGF-ONF", asset_class: "money_market", price: 1.00, previous_price: 1.00, price_mode: "manual" },

    // ── Real Estate ──
    { name: "Sankore Real Estate Trust", ticker: "SRE-REIT", asset_class: "real_estate", price: 215.75, previous_price: 212.50, price_mode: "manual" },
    { name: "Sankore Commercial Property Fund", ticker: "SRE-CPF", asset_class: "real_estate", price: 180.50, previous_price: 178.25, price_mode: "manual" },
    { name: "Sankore Residential REIT", ticker: "SRE-RES", asset_class: "real_estate", price: 125.40, previous_price: 124.80, price_mode: "manual" },
    { name: "Sankore Logistics & Industrial REIT", ticker: "SRE-LOG", asset_class: "real_estate", price: 152.60, previous_price: 151.20, price_mode: "manual" },
    { name: "Sankore Africa Real Estate Fund", ticker: "SRE-AFR", asset_class: "real_estate", price: 88.30, previous_price: 87.50, price_mode: "manual" },

    // ── Alternatives ──
    { name: "Sankore Gold Fund", ticker: "SGF-IAU", asset_class: "alternatives", price: 129.35, previous_price: 128.50, price_mode: "automated", price_source: "yahoo-finance" },
    { name: "Sankore Digital Assets Fund", ticker: "SGF-DIGI", asset_class: "alternatives", price: 320.00, previous_price: 315.50, price_mode: "manual" },
    { name: "Sankore Commodity Basket Fund", ticker: "SGF-COMD", asset_class: "alternatives", price: 78.40, previous_price: 77.90, price_mode: "manual" },
    { name: "Sankore Private Equity Fund I", ticker: "SGF-PE1", asset_class: "alternatives", price: 250.00, previous_price: 248.00, price_mode: "manual" },
    { name: "Sankore Venture Capital Fund", ticker: "SGF-VCF", asset_class: "alternatives", price: 185.60, previous_price: 182.30, price_mode: "manual" },
    { name: "Sankore Hedge Strategy Fund", ticker: "SGF-HSF", asset_class: "alternatives", price: 142.10, previous_price: 141.50, price_mode: "manual" },
  ];

  let created = 0;
  let updated = 0;
  for (const product of allProducts) {
    const existing = await prisma.product.findUnique({ where: { ticker: product.ticker } });
    if (existing) {
      // Don't overwrite existing products, just make sure asset_class is correct
      if (existing.asset_class !== product.asset_class) {
        await prisma.product.update({
          where: { ticker: product.ticker },
          data: { asset_class: product.asset_class },
        });
        updated++;
      }
    } else {
      await prisma.product.create({ data: product });
      created++;
    }
  }
  
  const all = await prisma.product.findMany({ orderBy: [{ asset_class: "asc" }, { name: "asc" }] });
  console.log(`Created ${created}, updated ${updated}. Total products: ${all.length}\n`);
  
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
