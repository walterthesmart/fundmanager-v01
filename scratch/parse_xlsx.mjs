import pkg from 'xlsx';
const { readFile, utils } = pkg;

const workbook = readFile('C:/Users/nwaug/Downloads/Gold fund schedule.xlsx');
const sheet = workbook.Sheets['Movement'];
const data = utils.sheet_to_json(sheet, { header: 1 });

for (let i = 0; i < data.length; i++) {
  console.log(`Row ${i}:`, data[i]);
}
