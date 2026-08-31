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
  const filePath = path.join(process.cwd(), "Gold Fund Model 2026.xlsx");
  console.log(`Reading excel file from ${filePath}`);
  
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets["Daily NAV"];
  if (!sheet) {
    throw new Error("Sheet 'Daily NAV' not found");
  }
  
  // Get the product
  const product = await prisma.product.findUnique({
    where: { ticker: "SGF-IAU" }
  });
  
  if (!product) {
    throw new Error("Sankore Gold Fund product not found in database. Seed it first.");
  }
  
  // Read rows
  const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  
  let inserted = 0;
  
  // Start after header
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    let dateVal = row[0];
    if (!dateVal) continue;
    
    let occurred_at: Date;
    if (dateVal instanceof Date) {
      occurred_at = dateVal;
    } else if (typeof dateVal === 'number') {
      occurred_at = excelDateToJSDate(dateVal);
    } else {
      occurred_at = new Date(dateVal);
    }
    
    const navPerUnit = row[9];
    if (navPerUnit === undefined || typeof navPerUnit !== 'number') continue;
    
    // We don't have "old_price" easily accessible without tracking the previous row, 
    // but we can just use the previous row's nav or same as nav if it's the first.
    let old_price = navPerUnit;
    if (i > 1) {
      const prevRow = rows[i - 1];
      if (prevRow && typeof prevRow[9] === 'number') {
        old_price = prevRow[9];
      }
    }
    
    await prisma.priceHistory.create({
      data: {
        product_id: product.id,
        old_price,
        new_price: navPerUnit,
        mode: "manual",
        source: "excel-import",
        occurred_at,
      }
    });
    inserted++;
  }
  
  console.log(`Successfully seeded ${inserted} historical prices for ${product.name}`);
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
