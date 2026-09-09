import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import { calculateCleanPrice } from './src/lib/bond-math';

const prisma = new PrismaClient();
const SHEET_XLSX_URL = "https://docs.google.com/spreadsheets/d/11Mjg2bUjhoGF1phHxm7LESDPRABPfLq88o1vL4N4fYI/export?format=xlsx";

async function main() {
  const bonds = ['FGN 2035 Bond', 'FGN 2037 bond', 'FGN 2038 bond'];
  
  const instruments = await prisma.instrument.findMany({
    where: {
      symbol: { in: bonds.map(b => b.toUpperCase()) }
    }
  });

  console.log("Instruments found in DB:");
  for (const inst of instruments) {
    console.log(`- ${inst.symbol}: Coupon ${inst.coupon_rate}%, Maturity ${inst.maturity_date}`);
  }

  console.log("\nFetching sheet...");
  const response = await fetch(SHEET_XLSX_URL, { cache: "no-store" });
  const arrayBuffer = await response.arrayBuffer();
  const workbook = xlsx.read(arrayBuffer);

  const results: any[] = [];

  // FBNUK logic
  if (workbook.SheetNames.includes("FBNUK")) {
    const records = xlsx.utils.sheet_to_json<any>(workbook.Sheets["FBNUK"]!);
    for (const row of records) {
      const sheetSymbol = row["Symbol"];
      if (!sheetSymbol) continue;
      
      const bidYieldStr = row["Bid Yield"] || row["Bid %"];
      const bidYield = typeof bidYieldStr === 'number' ? bidYieldStr : parseFloat(bidYieldStr);
      
      const dbInst = instruments.find(i => i.symbol.toUpperCase() === sheetSymbol.toUpperCase());
      if (dbInst && !isNaN(bidYield)) {
        const cleanPrice = calculateCleanPrice(
          bidYield,
          dbInst.coupon_rate,
          new Date(),
          new Date(dbInst.maturity_date!),
          dbInst.coupon_freq || 2,
          dbInst.face_value || 100
        );
        results.push({ symbol: dbInst.symbol, source: 'FBNUK', yield: bidYield, computedCleanPrice: cleanPrice });
      }
    }
  }

  // Bloomberg logic
  if (workbook.SheetNames.includes("Bloomberg")) {
    const data = xlsx.utils.sheet_to_json<any[]>(workbook.Sheets["Bloomberg"]!, { header: 1 });
    if (data.length >= 5) {
      const symbolsRow = data[3]!;
      const latestDataRow = data[data.length - 1]!;
      
      for (let col = 0; col < symbolsRow.length; col++) {
        const rawSymbol = symbolsRow[col];
        if (!rawSymbol || typeof rawSymbol !== 'string') continue;
        
        let ytmVal = latestDataRow[col];
        if (ytmVal === '#N/A N/A' || ytmVal == null) continue;
        
        const ytmNum = typeof ytmVal === 'number' ? ytmVal : parseFloat(ytmVal);
        if (isNaN(ytmNum)) continue;

        const match = rawSymbol.match(/(20\d{2})/);
        if (match) {
          const year = match[1];
          const targetSymbol = `FGN ${year} BOND`.toUpperCase();
          const dbInst = instruments.find(i => i.symbol.toUpperCase() === targetSymbol);
          
          if (dbInst) {
            const cleanPrice = calculateCleanPrice(
              ytmNum,
              dbInst.coupon_rate,
              new Date(),
              new Date(dbInst.maturity_date!),
              dbInst.coupon_freq || 2,
              dbInst.face_value || 100
            );
            results.push({ symbol: dbInst.symbol, source: 'Bloomberg', rawSymbol, yield: ytmNum, computedCleanPrice: cleanPrice });
          }
        }
      }
    }
  }

  console.log("\nResults computed from sheet yields:");
  console.table(results);
}

main().catch(console.error).finally(() => prisma.$disconnect());
