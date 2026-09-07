import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

function parseCsvRows(filePath: string): any[] {
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    // Basic CSV parsing splitting by comma, might fail if values have commas
    // but looking at the data, it seems straightforward.
    const vals = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || "").trim(); });
    return row;
  });
}

async function main() {
  // 1. Find product SNK-EURO and update it. If not found by SNK-EURO, try GIF($)
  let existing = await prisma.product.findUnique({ where: { ticker: "SNK-EURO" } });
  if (!existing) {
     existing = await prisma.product.findUnique({ where: { ticker: "GIF($)" } });
  }

  if (!existing) {
      console.log("Could not find product SNK-EURO or GIF($)");
      return;
  }

  const updated = await prisma.product.update({
    where: { id: existing.id },
    data: {
      name: "Sankore Guaranteed Income Fund ($)",
      ticker: "GIF($)",
      currency: "USD",
    },
  });
  console.log(`Renamed product to: ${updated.name} [${updated.ticker}]`);

  const productId = updated.id;

  // 2. Clear existing transactions for this product
  await prisma.cashTransaction.deleteMany({ where: { product_id: productId } });
  await prisma.securityTransaction.deleteMany({ where: { product_id: productId } });
  console.log("Cleared existing transactions for GIF($)");

  // 3. Seed Security Transactions from USD GIF Trans.csv
  const secRows = parseCsvRows(path.join(process.cwd(), "USD GIF Trans.csv"));
  let secCount = 0;
  for (const row of secRows) {
    if (!row["Direction"] || !row["Face Value"]) continue;
    
    // Trade Date is like "2024-09-19 00:00:00" or similar depending on pandas export.
    const dateStr = row["Trade Date"];
    const date = new Date(dateStr);
    
    const units = parseFloat(row["Face Value"]);
    const price = parseFloat(row["Price"]);
    if (!Number.isFinite(units) || !Number.isFinite(price)) continue;

    const direction = row["Direction"].toUpperCase() === "BUY" ? "BUY" : "SELL";
    const bondName = row["Name of Asset"] || "";

    await prisma.securityTransaction.create({
      data: {
        product_id: productId,
        symbol: bondName,
        direction,
        units,
        price,
        currency: "USD",
        value_date: date,
        status: "completed",
      },
    });
    secCount++;
  }
  console.log(`Seeded ${secCount} security transactions`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
