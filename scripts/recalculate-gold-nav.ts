import { PrismaClient } from "@prisma/client";
import xlsx from "xlsx";
import path from "path";

const prisma = new PrismaClient();

// Helper to normalize Date object or Excel serial to YYYY-MM-DD string
function normalizeDate(val: any): string | null {
  if (!val) return null;
  let d: Date;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'number') {
    const utc_days = Math.floor(val - 25569);
    const utc_value = utc_days * 86400;
    d = new Date(utc_value * 1000);
  } else if (typeof val === 'string') {
    d = new Date(val);
  } else {
    return null;
  }
  
  if (isNaN(d.getTime())) return null;
  
  // Since cellDates: true uses local time by default in xlsx, let's just get the UTC date part or use a robust way.
  // Actually, xlsx might return UTC midnight or local midnight.
  // We can just use the year/month/date from the object.
  // Alternatively, just stringify and take the first 10 chars if it's ISO.
  // But due to timezone issues (e.g. 22:59:25 on the day before), let's add 12 hours before extracting to be safe if it's close to midnight.
  const adjusted = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  return adjusted.toISOString().split('T')[0];
}

async function main() {
  const filePath = path.join(process.cwd(), "Gold Fund Model 2026.xlsx");
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  
  // 1. Parse Market Data
  const marketSheet = workbook.Sheets["Market Data"];
  const marketRows = xlsx.utils.sheet_to_json<any[]>(marketSheet, { header: 1 });
  const marketMap: Record<string, number> = {};
  
  for (let i = 2; i < marketRows.length; i++) {
    const row = marketRows[i];
    if (!row || !row[0]) continue;
    const dStr = normalizeDate(row[0]);
    if (dStr && typeof row[1] === 'number') {
      marketMap[dStr] = row[1];
    }
  }
  
  // 2. Parse Subscriptions & Redemptions
  const subSheet = workbook.Sheets["Subscription & Redemption Data"];
  const subRows = xlsx.utils.sheet_to_json<any[]>(subSheet, { header: 1 });
  
  // map of date -> { cashDelta, unitsDelta }
  const subMap: Record<string, { cash: number, units: number }> = {};
  for (let i = 1; i < subRows.length; i++) {
    const row = subRows[i];
    if (!row || !row[0]) continue;
    const dStr = normalizeDate(row[0]);
    if (!dStr) continue;
    
    const type = row[2]; // 'Subscription' or 'Redemption'
    const cash = row[3] || 0; // Cash Amount
    const units = row[5] || 0; // Units
    
    if (!subMap[dStr]) subMap[dStr] = { cash: 0, units: 0 };
    
    if (type === 'Subscription') {
      subMap[dStr].cash += cash;
      subMap[dStr].units += units;
    } else if (type === 'Redemption') {
      subMap[dStr].cash -= cash;
      subMap[dStr].units -= units;
    }
  }
  
  // 3. Parse Activity Data
  const actSheet = workbook.Sheets["Activity Data"];
  const actRows = xlsx.utils.sheet_to_json<any[]>(actSheet, { header: 1 });
  
  // map of date -> { cashDelta, iauSharesDelta }
  const actMap: Record<string, { cash: number, shares: number }> = {};
  for (let i = 1; i < actRows.length; i++) {
    const row = actRows[i];
    if (!row || !row[0]) continue;
    const dStr = normalizeDate(row[0]);
    if (!dStr) continue;
    
    const type = row[1]; // e.g. 'IAU Purchase' or 'IAU Sell'
    const qty = row[3] || 0;
    const netCash = row[5] || 0;
    
    if (!actMap[dStr]) actMap[dStr] = { cash: 0, shares: 0 };
    
    actMap[dStr].cash += netCash;
    
    if (String(type).includes('Purchase')) {
      actMap[dStr].shares += qty;
    } else if (String(type).includes('Sell') || String(type).includes('Sale')) {
      actMap[dStr].shares -= qty;
    } else {
      // Just in case it's implicit
      actMap[dStr].shares += qty; // might be positive or negative already
    }
  }
  
  // Now simulate day by day
  const product = await prisma.product.findUnique({ where: { ticker: "SGF-IAU" } });
  if (!product) throw new Error("Product not found");
  
  // Clear existing history
  await prisma.priceHistory.deleteMany({
    where: { product_id: product.id }
  });
  console.log("Cleared old PriceHistory for Gold Fund");
  
  const startDateStr = "2025-03-27";
  const endDateStr = "2026-06-11";
  
  let current = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  let totalUnits = 0;
  let cashBalance = 0;
  let iauSharesHeld = 0;
  let lastIauPrice = 57.68; // Initial price around 2025-03-27
  let totalFeeAccrued = 0;
  
  let previousNavPerUnit = 100;
  
  let inserted = 0;
  
  while (current <= end) {
    const dStr = current.toISOString().split('T')[0];
    
    // 1. Process Sub/Red
    if (subMap[dStr]) {
      cashBalance += subMap[dStr].cash;
      totalUnits += subMap[dStr].units;
    }
    
    // 2. Process Activity
    if (actMap[dStr]) {
      cashBalance += actMap[dStr].cash;
      iauSharesHeld += actMap[dStr].shares;
    }
    
    // 3. Get Market Price
    if (marketMap[dStr]) {
      lastIauPrice = marketMap[dStr];
    }
    
    // 4. Calculate Values
    const portfolioValue = iauSharesHeld * lastIauPrice;
    const gav = portfolioValue + cashBalance;
    
    // Daily fee accrual: 3% per annum of GAV
    const dailyFee = (gav * 0.03) / 365;
    totalFeeAccrued += dailyFee;
    
    const nav = gav - totalFeeAccrued;
    const navPerUnit = totalUnits > 0 ? nav / totalUnits : 100; // default to 100 if no units
    
    await prisma.priceHistory.create({
      data: {
        product_id: product.id,
        old_price: previousNavPerUnit,
        new_price: navPerUnit,
        mode: "manual",
        source: "derived-calculation",
        occurred_at: new Date(current),
      }
    });
    inserted++;
    
    previousNavPerUnit = navPerUnit;
    
    // Increment day
    current.setDate(current.getDate() + 1);
  }
  
  console.log(`Recalculated and seeded ${inserted} exact NAV records up to ${endDateStr}`);
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
