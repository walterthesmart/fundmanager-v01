import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

const SPREADSHEET_ID = "11Mjg2bUjhoGF1phHxm7LESDPRABPfLq88o1vL4N4fYI";

// List your sheet GIDs here. Order matters!
// The script will prioritize prices found in the FIRST tab in this list. 
// If an instrument is not found in the first, it will look in the second, and so on.
const TAB_GIDS = [
  "0",          // FBNUK tab
  "2001688424", // Fallback tab 1
  "585695057",  // Fallback tab 2
];

// MAPPING DICTIONARY
const SYMBOL_MAPPING: Record<string, string> = {
  "REPUBLIC OF ANGOLA OCT 2035": "ANGOL 9.875 10/15/35",
  "SEPLAT ENERGY MAR 2030": "SEPLAT 9.125 03/21/30",
  "REPUBLIC OF NIGERIA FEB 2038": "FGN 2038 bond",
  // ADD MORE MAPPINGS HERE
};

async function main() {
  console.log("Fetching live prices from Google Sheet...");
  
  let updatedCount = 0;
  let notFoundCount = 0;
  let unmappedCount = 0;
  
  // Track found symbols to avoid overwriting with lower-priority tabs
  const foundSymbols = new Set<string>();

  try {
    for (const gid of TAB_GIDS) {
      const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
      const response = await fetch(SHEET_CSV_URL);
      
      if (!response.ok) {
        console.error(`Failed to fetch sheet with GID ${gid}: ${response.statusText}`);
        continue;
      }
      
      const csvText = await response.text();
      const records = parse(csvText, {
        skip_empty_lines: true,
        trim: true,
      });

      if (records.length === 0) continue;

      console.log(`\nProcessing tab GID: ${gid}`);

      // Detect if this is the pivoted FBNUK format or standard flat format
      const isPivoted = records[0][0] === "DS002";
      
      if (isPivoted) {
        console.log("Detected pivoted format (FBNUK tab style).");
        if (records.length < 4) continue;
        
        const symbolsRow = records[3];
        const latestPricesRow = records[records.length - 1]; // Last row holds the latest prices
        
        for (let i = 3; i < symbolsRow.length; i++) {
          const sheetSymbol = symbolsRow[i];
          const bidPxStr = latestPricesRow[i];
          
          if (!sheetSymbol || !bidPxStr || bidPxStr === "#N/A N/A") continue;
          
          const bidPx = parseFloat(bidPxStr);
          if (isNaN(bidPx)) continue;
          
          const dbSymbol = SYMBOL_MAPPING[sheetSymbol] || sheetSymbol;
          
          if (foundSymbols.has(dbSymbol)) continue;
          
          const instrument = await prisma.instrument.findFirst({ where: { symbol: dbSymbol } });
          
          if (instrument) {
            await prisma.instrument.update({
              where: { id: instrument.id },
              data: { market_price: bidPx },
            });
            console.log(`✅ Updated ${dbSymbol}: Bid Px = ${bidPx}`);
            foundSymbols.add(dbSymbol);
            updatedCount++;
          } else {
             if (SYMBOL_MAPPING[sheetSymbol]) {
               console.log(`❌ Instrument not found in DB: ${dbSymbol}`);
               notFoundCount++;
             } else {
               console.log(`❓ Unmapped / Not found: "${sheetSymbol}"`);
               unmappedCount++;
             }
          }
        }
      } else {
        console.log("Detected flat format.");
        const headers = records[0];
        const symbolIdx = headers.indexOf("Symbol");
        const bidPxIdx = headers.indexOf("Bid Px");
        const bidYieldIdx = headers.indexOf("Bid Yield") !== -1 ? headers.indexOf("Bid Yield") : headers.indexOf("Bid %");
        
        if (symbolIdx === -1 || bidPxIdx === -1) {
           console.log("Could not find 'Symbol' and 'Bid Px' columns. Skipping tab.");
           continue;
        }

        for (let i = 1; i < records.length; i++) {
          const row = records[i];
          const sheetSymbol = row[symbolIdx];
          if (!sheetSymbol) continue;
          
          const bidPxStr = row[bidPxIdx];
          const bidPx = parseFloat(bidPxStr);
          if (isNaN(bidPx)) continue;

          const bidYieldStr = bidYieldIdx !== -1 ? row[bidYieldIdx] : undefined;
          const bidYield = bidYieldStr ? parseFloat(bidYieldStr) : NaN;

          const dbSymbol = SYMBOL_MAPPING[sheetSymbol] || sheetSymbol;
          if (foundSymbols.has(dbSymbol)) continue;

          const instrument = await prisma.instrument.findFirst({ where: { symbol: dbSymbol } });

          if (instrument) {
            await prisma.instrument.update({
              where: { id: instrument.id },
              data: {
                market_price: bidPx,
                market_ytm: isNaN(bidYield) ? null : bidYield,
              },
            });
            console.log(`✅ Updated ${dbSymbol}: Bid Px = ${bidPx}`);
            foundSymbols.add(dbSymbol);
            updatedCount++;
          } else {
             if (SYMBOL_MAPPING[sheetSymbol]) {
               console.log(`❌ Instrument not found in DB: ${dbSymbol}`);
               notFoundCount++;
             } else {
               console.log(`❓ Unmapped / Not found: "${sheetSymbol}"`);
               unmappedCount++;
             }
          }
        }
      }
    }

    console.log("\n--- UPDATE SUMMARY ---");
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Not found in DB: ${notFoundCount}`);
    console.log(`Unmapped in script: ${unmappedCount}`);
    
    console.log("\nTo map missing bonds, add them to the SYMBOL_MAPPING dictionary in scripts/update-prices-from-sheet.ts");

  } catch (error) {
    console.error("Error updating prices from sheet:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
