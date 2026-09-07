import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import { parseCsv } from "../src/lib/csv";

const prisma = new PrismaClient();

function parseDate(dateStr: string) {
  if (!dateStr) return new Date();
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  return new Date(`${y}-${m}-${d}T00:00:00Z`);
}

async function main() {
  const product = await prisma.product.findUnique({ where: { ticker: "SGEF-MCB" } });
  if (!product) throw new Error("Product SGEF-MCB not found in database. Make sure to run the seed script first.");

  console.log(`Found product ${product.name} with ID ${product.id}`);

  // Clear existing transactions for this product to prevent duplicates
  await prisma.cashTransaction.deleteMany({ where: { product_id: product.id } });
  await prisma.securityTransaction.deleteMany({ where: { product_id: product.id } });
  console.log("Cleared old transactions for this product to ensure a clean import...");

  // 1. Parse and insert Cash Transactions
  const cashCsvRaw = fs.readFileSync("c:\\Users\\nwaug\\Desktop\\fundmanager-v01\\StoneX GEF Cash - New.csv", "utf8");
  const cashRows = parseCsv(cashCsvRaw);

  let cashCount = 0;
  for (const row of cashRows) {
    if (!row.symb) continue; 
    const amount = parseFloat(row.bnum);
    if (isNaN(amount)) continue;

    let direction = row.tran === "TXIN" ? "inflow" : "outflow";

    await prisma.cashTransaction.create({
      data: {
        product_id: product.id,
        direction,
        amount,
        value_date: parseDate(row.ed),
        narration: row.memo || "",
        reference: `CASH-${row.ed}-${cashCount}`,
        currency: row.currency || "USD",
        status: "approved", 
      }
    });
    cashCount++;
  }
  console.log(`Inserted ${cashCount} cash transactions.`);

  // 2. Parse and insert Security Transactions
  const txCsvRaw = fs.readFileSync("c:\\Users\\nwaug\\Desktop\\fundmanager-v01\\Stone X GEF Transactions (SPL) - New.csv", "utf8");
  const txRows = parseCsv(txCsvRaw);

  let txCount = 0;
  for (const row of txRows) {
    if (!row.symb) continue;
    const units = parseFloat(row.bnum);
    const price = parseFloat(row.anum);
    if (isNaN(units) || isNaN(price)) continue;

    const direction = row.tran === "BUY" ? "BUY" : "SELL";

    await prisma.securityTransaction.create({
      data: {
        product_id: product.id,
        direction,
        symbol: row.symb,
        units,
        price,
        value_date: parseDate(row.ed),
        currency: "USD",
        status: "completed",
      }
    });
    txCount++;
  }
  console.log(`Inserted ${txCount} security transactions.`);
  
  console.log("Import successfully completed! The AUM trajectory chart will now dynamically generate based on these records.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
