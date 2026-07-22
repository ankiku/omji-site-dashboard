import XLSX from 'xlsx';

const filePath = './Omji_Construction_ProjectSchedule_v8.xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log("Sheet structure (first 40 rows):");
for (let i = 0; i < Math.min(rows.length, 40); i++) {
  console.log(`Row ${i}:`, rows[i]);
}
