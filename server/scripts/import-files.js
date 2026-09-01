import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const root = path.resolve(process.cwd(), '..');
const xlsxPath = process.argv[2] || path.resolve(root, 'data/Indicadores_ABNT.xlsx');
const csvPath = process.argv[3] || path.resolve(root, 'data/indicadores_auxiliares.csv');

if (!fs.existsSync(xlsxPath)) throw new Error(`Arquivo não encontrado: ${xlsxPath}`);
const wb = XLSX.readFile(xlsxPath, { cellDates: true, cellFormula: true });
const standards = ['37120', '37122', '37123'];
for (const name of standards) {
  const sheet = wb.Sheets[name];
  if (!sheet) { console.warn(`Aba ${name} não encontrada.`); continue; }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
  console.log(`${name}: ${rows.filter(r => r.Indicador).length} indicadores detectados.`);
}
if (fs.existsSync(csvPath)) {
  const csvBook = XLSX.readFile(csvPath, { type: 'file' });
  const sheet = csvBook.Sheets[csvBook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  console.log(`CSV auxiliar: ${rows.filter(r => r?.[0]).length} linhas detectadas.`);
}
console.log('\nA importação inicial do projeto já foi normalizada em data/seed.json.');
console.log('Para atualizar a base com uma nova planilha preservando dados validados, use o fluxo de seed/importação após revisar os mapeamentos.');
