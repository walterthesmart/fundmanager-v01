import xlsx from "xlsx"
import path from "path"

const filePath = path.join(process.cwd(), "Gold Fund Model 2026.xlsx");
const workbook = xlsx.readFile(filePath, { cellDates: true });

const sheetsToDump = ["Subscription & Redemption Data", "Activity Data", "Market Data"];

for (const name of sheetsToDump) {
  const sheet = workbook.Sheets[name];
  if (sheet) {
    const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    console.log(`\n--- ${name} ---`);
    console.log("Headers:", rows[0]);
    console.log("Row 1:", rows[1]);
    console.log("Row 2:", rows[2]);
    console.log("Last Row:", rows[rows.length - 1]);
  } else {
    console.log(`\n--- ${name} --- NOT FOUND`);
  }
}
