const xlsx = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "../Gold Fund Model 2026.xlsx");
const workbook = xlsx.readFile(filePath);

const sheetNames = workbook.SheetNames;
console.log("Sheet names:", sheetNames);

for (const sheetName of sheetNames) {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // print first 10 rows
  for (let i = 0; i < Math.min(10, json.length); i++) {
    console.log(json[i]);
  }
}
