import { PrismaClient } from "@prisma/client";
import xlsx from "xlsx";
import path from "path";

const prisma = new PrismaClient();

function normalizeDate(val: any): Date | null {
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
  // Offset to avoid timezone shifting to previous day
  const adjusted = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  return adjusted;
}

async function main() {
  const filePath = path.join(process.cwd(), "Gold Fund Model 2026.xlsx");
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  
  const product = await prisma.product.findUnique({ where: { ticker: "SGF-IAU" } });
  if (!product) throw new Error("Gold fund product not found");

  // 1. Seed Price History from Daily NAV
  console.log("Seeding Price History from Daily NAV...");
  const dailySheet = workbook.Sheets["Daily NAV"];
  if (!dailySheet) throw new Error("Sheet 'Daily NAV' not found");
  const dailyRows = xlsx.utils.sheet_to_json<any[]>(dailySheet, { header: 1 });
  
  await prisma.priceHistory.deleteMany({ where: { product_id: product.id } });
  
  let pricesInserted = 0;
  for (let i = 1; i < dailyRows.length; i++) {
    const row = dailyRows[i];
    if (!row || !row[0]) continue;
    const date = normalizeDate(row[0]);
    if (!date) continue;
    
    const navPerUnit = row[9];
    if (navPerUnit === undefined || typeof navPerUnit !== 'number') continue;
    
    await prisma.priceHistory.create({
      data: {
        product_id: product.id,
        new_price: navPerUnit,
        mode: "manual",
        source: "excel-import",
        occurred_at: date,
      }
    });
    pricesInserted++;
  }
  console.log(`Inserted ${pricesInserted} price history records`);

  // 2. Seed Subscriptions & Redemptions
  console.log("Seeding Subscriptions and Redemptions...");
  const subSheet = workbook.Sheets["Subscription & Redemption Data"];
  if (!subSheet) throw new Error("Sheet 'Subscription & Redemption Data' not found");
  const subRows = xlsx.utils.sheet_to_json<any[]>(subSheet, { header: 1 });
  
  await prisma.cashTransaction.deleteMany({ where: { product_id: product.id } });
  
  let txInserted = 0;
  for (let i = 1; i < subRows.length; i++) {
    const row = subRows[i];
    if (!row || !row[0]) continue;
    
    const date = normalizeDate(row[0]);
    if (!date) continue;
    
    const clientName = row[1];
    if (!clientName) continue;
    
    const type = row[2]; // Subscription or Redemption
    const amount = row[3];
    const nav = row[4];
    const units = row[5];
    
    if (typeof amount !== 'number') continue;
    
    let client = await prisma.client.findFirst({ where: { name: clientName } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          name: clientName,
          identifier: clientName.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now(),
        }
      });
    }
    
    const direction = type === 'Subscription' ? 'inflow' : 'outflow';
    
    await prisma.cashTransaction.create({
      data: {
        client_id: client.id,
        product_id: product.id,
        source_name: clientName,
        direction,
        amount,
        currency: "USD",
        value_date: date,
        reference: `EXCEL-${i}`,
        narration: `${type} @ ${nav.toFixed(2)} NAV. Units: ${units.toFixed(2)}`,
        entry_source: "excel-import",
        status: "approved"
      }
    });
    txInserted++;
  }
  
  console.log(`Inserted ${txInserted} cash transactions`);
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
