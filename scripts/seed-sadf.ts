import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { calculateDirtyPriceFromYTM, calculateCleanPrice } from "../src/lib/bond-math";

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
  const productName = "Sankore Africa Development Fund";
  const ticker = "SADF";

  let product = await prisma.product.findUnique({ where: { ticker } });
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: productName,
        ticker: ticker,
        asset_class: "global_fixed_income",
        currency: "USD",
        price: 100, // default
        price_mode: "manual",
      }
    });
    console.log(`Created product: ${product.name} [${product.ticker}]`);
  } else {
    console.log(`Found product: ${product.name} [${product.ticker}]`);
  }

  const productId = product.id;

  // Clear existing transactions for this product to avoid duplicates
  await prisma.cashTransaction.deleteMany({ where: { product_id: productId } });
  await prisma.securityTransaction.deleteMany({ where: { product_id: productId } });
  console.log(`Cleared existing transactions for ${ticker}`);

  const csvPath = path.join(process.cwd(), "MCB FI Trans (1).csv");
  const rows = parseCsvRows(csvPath);

  let count = 0;
  for (const row of rows) {
    if (!row["SYMB"] || !row["DIRTY PRICE"]) continue;

    function parseDateCustom(dateStr: string): Date {
      const d = new Date(dateStr);
      if (d.getFullYear() < 2000) {
        d.setFullYear(d.getFullYear() + 100);
      }
      return d;
    }

    const symbol = row["SYMB"];
    const settlementDate = parseDateCustom(row["SETTLEMENT DATE"]);
    const maturityDate = parseDateCustom(row["MATURITY DATE"]);
    const direction = row["TRAN"] === "SELL" ? "SELL" : "BUY";
    const dirtyPrice = parseFloat(row["DIRTY PRICE"]);
    
    const faceValueAmount = parseFloat(row["FACE VALUE"]) * 100;
    const bondUnits = faceValueAmount / 100; // Divide by 100 per convention used in GIF

    // handle 8.88% format
    const couponStr = row["BONDCOUP"].replace("%", "");
    const couponRate = parseFloat(couponStr); 
    
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
  console.log(`Seeded ${count} security transactions with reverse-engineered YTM for ${ticker}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
