import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

function parseDate(dateStr: string): Date {
  // Format: YYYYMMDD
  const y = parseInt(dateStr.substring(0, 4));
  const m = parseInt(dateStr.substring(4, 6)) - 1;
  const d = parseInt(dateStr.substring(6, 8));
  return new Date(y, m, d);
}

function parseCsvRows(filePath: string): any[] {
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || "").trim(); });
    return row;
  });
}

async function main() {
  // 1. Rename product
  const updated = await prisma.product.update({
    where: { ticker: "GIF(₦)" },
    data: {
      name: "Sankore Guaranteed Income Fund (₦)",
      ticker: "GIF(₦)",
      currency: "NGN",
    },
  });
  console.log(`Renamed product to: ${updated.name} [${updated.ticker}]`);

  const productId = updated.id;

  // 2. Clear existing transactions for this product
  await prisma.cashTransaction.deleteMany({ where: { product_id: productId } });
  await prisma.securityTransaction.deleteMany({ where: { product_id: productId } });
  console.log("Cleared existing transactions for GIF(₦)");

  // 3. Seed Cash Transactions from GIF NGN Cash.csv
  const cashRows = parseCsvRows(path.join(process.cwd(), "GIF NGN Cash.csv"));
  let cashCount = 0;
  for (const row of cashRows) {
    if (!row.ED || !row.BNUM) continue;
    const date = parseDate(row.ED);
    const amount = parseFloat(row.BNUM);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const direction = row.TRAN === "TXIN" ? "inflow" : "outflow";
    const memo = row.MEMO || "";

    await prisma.cashTransaction.create({
      data: {
        product_id: productId,
        source_name: row.SYMB || "GIFN Cash",
        direction,
        amount,
        currency: "NGN",
        value_date: date,
        reference: `GIFN-CASH-${cashCount + 1}`,
        narration: memo,
        entry_source: "csv-import",
        status: "approved",
      },
    });
    cashCount++;
  }
  console.log(`Seeded ${cashCount} cash transactions`);

  // 4. Seed Security Transactions from Stanbic NGN FI Trans.csv
  const secRows = parseCsvRows(path.join(process.cwd(), "Stanbic NGN FI Trans.csv"));
  let secCount = 0;
  for (const row of secRows) {
    if (!row.ED || !row.BNUM) continue;
    const date = parseDate(row.ED);
    const units = parseFloat(row.BNUM);
    const price = parseFloat(row.ANUM);
    if (!Number.isFinite(units) || !Number.isFinite(price)) continue;

    const direction = row.TRAN === "BUY" ? "BUY" : "SELL";
    const bondName = row.SYMB || "";
    const coupon = row.BONDCOUP || "";
    const maturity = row.BONDMAT || "";

    await prisma.securityTransaction.create({
      data: {
        product_id: productId,
        symbol: bondName,
        direction,
        units,
        price,
        currency: "NGN",
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
