import { PrismaClient } from "@prisma/client"
import xlsx from "xlsx"
import path from "path"

const prisma = new PrismaClient()

// Convert excel serial date to JS Date
function excelDateToJSDate(serial: number) {
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  // Optional: handle timezone offset if needed
  return date_info;
}

async function main() {
  const filePath = path.join(process.cwd(), "Gold Fund", "Gold Fund Model 2026.xlsx");
  console.log(`Reading excel file from ${filePath}`);
  
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets["Market Data"];
  if (!sheet) {
    throw new Error("Sheet 'Market Data' not found");
  }
  
  // Get the product
  const product = await prisma.product.findUnique({
    where: { ticker: "SGF-IAU" }
  });
  
  if (!product) {
    throw new Error("Sankore Gold Fund product not found in database. Seed it first.");
  }
  
  // Clear existing history
  console.log("Clearing existing price history for Gold Fund...");
  await prisma.priceHistory.deleteMany({ where: { product_id: product.id } });

  // Read rows
  const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  
  let inserted = 0;
  
  // Start after headers (Row 0 has "Date", "Close", etc., and Row 1 is usually first data, but pandas showed "Date" "Close" as row 1? Wait, let's just skip non-dates)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    
    let dateVal = row[0];
    if (!dateVal) continue;
    
    let occurred_at: Date;
    if (dateVal instanceof Date) {
      occurred_at = dateVal;
    } else if (typeof dateVal === 'number') {
      occurred_at = excelDateToJSDate(dateVal);
    } else {
      const parsed = new Date(dateVal);
      if (isNaN(parsed.getTime())) continue;
      occurred_at = parsed;
    }
    
    const priceVal = row[1]; // IAU close column
    if (priceVal === undefined || typeof priceVal !== 'number') continue;
    
    let old_price = priceVal;
    
    await prisma.priceHistory.create({
      data: {
        product_id: product.id,
        old_price,
        new_price: priceVal,
        mode: "manual",
        source: "excel-import",
        occurred_at,
      }
    });
    inserted++;
  }
  
  console.log(`Successfully seeded ${inserted} historical prices from Market Data for ${product.name}`);
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
