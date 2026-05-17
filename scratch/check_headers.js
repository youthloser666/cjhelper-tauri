const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../../db-new.xlsx');
console.log('Loading Excel from:', filePath);
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get headers
const range = xlsx.utils.decode_range(worksheet['!ref']);
const headers = [];
for (let col = range.s.c; col <= range.e.c; col++) {
  const cell = worksheet[xlsx.utils.encode_cell({ r: 0, c: col })];
  headers.push(cell ? cell.v : `Col_${col}`);
}

console.log('Headers count:', headers.length);
headers.forEach((h, idx) => {
  if (h.toUpperCase().includes('TLP') || idx === 50) {
    console.log(`Index ${idx}: "${h}"`);
  }
});
