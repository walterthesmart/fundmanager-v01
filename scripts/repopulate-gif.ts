import { PrismaClient } from "@prisma/client";
import path from "path";
import { calculateDirtyPriceFromYTM, calculateCleanPrice } from "../src/lib/bond-math";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const prisma = new PrismaClient();

function findYtm(
  targetDirtyPrice: number,
  couponRate: number,
  settlementDate: Date,
  maturityDate: Date,
  couponFreq: number,
  faceValue: number = 100
): number {
  let low = -50;
  let high = 200;
  let mid = 0;
  
  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const price = calculateDirtyPriceFromYTM(mid, couponRate, settlementDate, maturityDate, couponFreq, faceValue);
    
    if (Math.abs(price - targetDirtyPrice) < 0.0001) {
      return mid;
    }
    
    if (price > targetDirtyPrice) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  return mid;
}

async function main() {
  let existing = await prisma.product.findUnique({ where: { ticker: "GIF($)" } });
  if (!existing) {
     existing = await prisma.product.findFirst({ where: { name: "Sankore Guaranteed Income Fund ($)" } });
  }

  if (!existing) {
      console.log("Could not find product GIF($)");
      return;
  }
  console.log(`Found product: ${existing.name} [${existing.ticker}]`);

  const productId = existing.id;

  // Clear existing transactions for this product
  await prisma.cashTransaction.deleteMany({ where: { product_id: productId } });
  await prisma.securityTransaction.deleteMany({ where: { product_id: productId } });
  console.log("Cleared existing transactions for GIF($)");

  // Read the Excel file
  const filePath = path.join(process.cwd(), "GIF($).xlsx");
  const fs = require("fs");
  const xlsx = require("xlsx");
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(fileBuffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<any>(sheet);

  let count = 0;
  for (const row of rows) {
    if (!row["SYMB"] || !row["DIRTY PRICE"]) continue;
    
    const symbol = row["SYMB"];
    const settlementDate = new Date(row["SETTLEMENT DATE"]);
    const maturityDate = new Date(row["MATURITY DATE"]);
    const direction = row["TRAN"] === "SELL" ? "SELL" : "BUY";
    const dirtyPrice = parseFloat(row["DIRTY PRICE"]);
    const units = parseFloat(row["FACE VALUE"]); // Use FACE VALUE as units per typical fixed income convention, or BNUM? 
    // Wait, let's look at BNUM vs FACE VALUE. 
    // Python output: BNUM: 11000, FACE VALUE: 1100000. BNUM * 100 = FACE VALUE.
    // In seed script they used FACE VALUE as units. I will use FACE VALUE as units.
    const faceValueAmount = parseFloat(row["FACE VALUE"]);
    const bondUnits = faceValueAmount / 100; // Divide by 100 as per user request
    const bondCoupDec = parseFloat(row["BONDCOUP"]); // e.g. 0.0875
    const couponRate = bondCoupDec * 100; // e.g. 8.75
    const couponFreq = parseInt(row["BONDFREQ"]) || 2;
    const currency = row["CURRENCY"] || "USD";

    // 1. Find YTM from dirty price
    const ytm = findYtm(dirtyPrice, couponRate, settlementDate, maturityDate, couponFreq);
    
    // 2. Calculate Clean Price
    const cleanPrice = calculateCleanPrice(ytm, couponRate, settlementDate, maturityDate, couponFreq, 100);

    await prisma.securityTransaction.create({
      data: {
        product_id: productId,
        symbol: symbol,
        direction,
        units: bondUnits,
        price: cleanPrice,
        ytm: ytm,
        currency,
        value_date: settlementDate,
        status: "completed",
      },
    });
    count++;
  }
  console.log(`Seeded ${count} security transactions with reverse-engineered YTM.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
