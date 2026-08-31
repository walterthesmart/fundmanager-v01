import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { addDays, format, isBefore, isAfter, isEqual, parse, differenceInDays } from "date-fns";

const prisma = new PrismaClient();

function parseDate(dateStr: string): Date {
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

function parseCoupon(coup: string): number {
  if (!coup) return 0;
  return parseFloat(coup.replace("%", "")) / 100;
}

// Fixed Income Engine
async function main() {
  const gifProduct = await prisma.product.findUnique({ where: { ticker: "GIF(₦)" } });
  if (!gifProduct) throw new Error("GIF(₦) product not found");

  const cashRows = parseCsvRows(path.join(process.cwd(), "GIF NGN Cash.csv"));
  const secRows = parseCsvRows(path.join(process.cwd(), "Stanbic NGN FI Trans.csv"));

  // Sort chronologically
  cashRows.sort((a, b) => parseDate(a.ED).getTime() - parseDate(b.ED).getTime());
  secRows.sort((a, b) => parseDate(a.ED).getTime() - parseDate(b.ED).getTime());

  if (cashRows.length === 0 && secRows.length === 0) {
    console.log("No data to process.");
    return;
  }

  const startDate = new Date(Math.min(
    parseDate(cashRows[0].ED).getTime(),
    parseDate(secRows[0].ED).getTime()
  ));
  // Let's run until end of August 2026
  const endDate = new Date(2026, 7, 31); 

  let cashBalance = 0;
  // Bonds portfolio: we track active lots
  // A lot is: { name, units, price, coupon, buyDate }
  let activeBonds: any[] = [];

  let cashIndex = 0;
  let secIndex = 0;

  const dailyNavs = [];

  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    // 1. Process cash transactions for the day
    while (cashIndex < cashRows.length && parseDate(cashRows[cashIndex].ED).getTime() === d.getTime()) {
      const row = cashRows[cashIndex];
      const amount = parseFloat(row.BNUM) || 0;
      if (row.TRAN === "TXIN") cashBalance += amount;
      else if (row.TRAN === "TXOUT") cashBalance -= amount;
      cashIndex++;
    }

    // 2. Process security transactions for the day
    while (secIndex < secRows.length && parseDate(secRows[secIndex].ED).getTime() === d.getTime()) {
      const row = secRows[secIndex];
      const units = parseFloat(row.BNUM) || 0;
      const price = parseFloat(row.ANUM) || 0;
      const coupon = parseCoupon(row.BONDCOUP);

      if (row.TRAN === "BUY") {
        activeBonds.push({
          name: row.SYMB,
          units,
          price,
          coupon,
          buyDate: d,
        });
        // Buying bond reduces cash by (units * price) / 100 
        // Assuming Nigerian convention where price is per 100 face value
        const cost = (units * price) / 100;
        cashBalance -= cost;
      } else if (row.TRAN === "SELL") {
        // Find matching lots and remove/reduce them
        let remainingToSell = units;
        for (let i = 0; i < activeBonds.length; i++) {
          if (activeBonds[i].name === row.SYMB && activeBonds[i].units > 0) {
            if (activeBonds[i].units <= remainingToSell) {
              remainingToSell -= activeBonds[i].units;
              activeBonds[i].units = 0;
            } else {
              activeBonds[i].units -= remainingToSell;
              remainingToSell = 0;
            }
          }
          if (remainingToSell <= 0) break;
        }
        // Selling bond increases cash
        const proceeds = (units * price) / 100;
        cashBalance += proceeds;
      }
      secIndex++;
    }

    // Clean up fully sold bonds
    activeBonds = activeBonds.filter(b => b.units > 0);

    // 3. Calculate portfolio value (Amortized Cost + Accrued Interest)
    let bondsValue = 0;
    for (const bond of activeBonds) {
      // Amortized carrying value = units * (price/100) + accrued interest
      // Simple straight-line accrued interest from buy date
      const daysHeld = differenceInDays(d, bond.buyDate);
      const faceValue = bond.units;
      const purchaseValue = faceValue * (bond.price / 100);
      
      // Accrued interest on face value (Actual/365)
      const accrued = faceValue * bond.coupon * (daysHeld / 365);
      
      bondsValue += (purchaseValue + accrued);
    }

    const totalAUM = cashBalance + bondsValue;

    // We save Total AUM as the Price for GIF(₦) since it's a fixed value fund
    dailyNavs.push({
      product_id: gifProduct.id,
      occurred_at: new Date(d),
      new_price: totalAUM,
    });
  }

  // Save to DB
  await prisma.priceHistory.deleteMany({ where: { product_id: gifProduct.id } });
  
  // Batch insert
  const batchSize = 100;
  for (let i = 0; i < dailyNavs.length; i += batchSize) {
    await prisma.priceHistory.createMany({
      data: dailyNavs.slice(i, i + batchSize)
    });
  }

  console.log(`Generated and inserted ${dailyNavs.length} daily NAV records for GIF(₦)`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
