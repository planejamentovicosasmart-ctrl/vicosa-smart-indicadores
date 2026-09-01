import '../src/lib/env.js';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.resolve(__dirname, '../../data');
const seedPartNames = ['seed.gz.b64.part1.txt','seed.gz.b64.part2.txt','seed.gz.b64.part3.txt','seed.gz.b64.part4.txt'];
const seedBase64 = (await Promise.all(seedPartNames.map((name) => fs.readFile(path.join(seedDir, name), 'utf8')))).join('').trim();
const seed = JSON.parse(gunzipSync(Buffer.from(seedBase64, 'base64')).toString('utf8'));

const standardsMeta = {
  '37120': { title: 'ISO 37120', subtitle: 'Cidades Sustentáveis', description: 'Indicadores para serviços urbanos e qualidade de vida.' },
  '37122': { title: 'ISO 37122', subtitle: 'Cidades Inteligentes', description: 'Indicadores para cidades inteligentes e uso de tecnologia.' },
  '37123': { title: 'ISO 37123', subtitle: 'Cidades Resilientes', description: 'Indicadores de resiliência urbana e preparação para riscos.' },
};

function statusOf(row) {
  const hasN = Boolean(row.numeratorRaw || row.numeratorNumber !== null);
  const hasD = Boolean(row.denominatorRaw || row.denominatorNumber !== null);
  const hasF = Boolean(row.finalRaw || row.finalNumber !== null);
  if (row.unit === '%' && row.finalNumber != null && (row.finalNumber < 0 || row.finalNumber > 100)) return 'REVIEW_NEEDED';
  if (row.numeratorYear && row.denominatorYear && row.numeratorYear !== row.denominatorYear) return 'REVIEW_NEEDED';
  if (!hasN && !hasD && (row.notes || '').toLowerCase().includes('solicitar')) return 'NEEDS_REQUEST';
  if (hasF || (hasN && hasD)) return 'COMPLETE';
  if (hasN || hasD) return 'PARTIAL';
  return 'NOT_STARTED';
}

function priorityOf(row) {
  const hasN = Boolean(row.numeratorRaw || row.numeratorNumber !== null);
  const hasD = Boolean(row.denominatorRaw || row.denominatorNumber !== null);
  let score = 50;
  if (hasN !== hasD) score += 30;
  if (row.notes) score += 10;
  if ((row.notes || '').toLowerCase().includes('solicitar')) score -= 8;
  if (!hasN && !hasD) score -= 10;
  return Math.max(1, Math.min(100, score));
}

const standardByCode = {};
for (const code of Object.keys(standardsMeta)) {
  const meta = standardsMeta[code];
  standardByCode[code] = await prisma.standard.upsert({ where: { code }, update: meta, create: { code, ...meta } });
}

const indicatorKeyToId = new Map();
let imported = 0;
for (const row of seed.indicators) {
  const standard = standardByCode[row.standard];
  const indicator = await prisma.indicator.upsert({
    where: { standardId_code: { standardId: standard.id, code: row.code } },
    update: { name: row.name, numeratorDescription: row.numeratorDescription, denominatorDescription: row.denominatorDescription, unit: row.unit, notes: row.notes, sourceRow: row.sourceRow, priority: priorityOf(row) },
    create: { standardId: standard.id, code: row.code, name: row.name, numeratorDescription: row.numeratorDescription, denominatorDescription: row.denominatorDescription, unit: row.unit, notes: row.notes, status: statusOf(row), sourceRow: row.sourceRow, priority: priorityOf(row) },
  });
  indicatorKeyToId.set(`${row.standard}:${row.code}`, indicator.id);
  const current = await prisma.indicatorValue.findFirst({ where: { indicatorId: indicator.id, isCurrent: true }, orderBy: { createdAt: 'desc' } });
  const valueData = { numeratorRaw: row.numeratorRaw, numeratorNumber: row.numeratorNumber, numeratorYear: row.numeratorYear, numeratorSource: row.numeratorSource, denominatorRaw: row.denominatorRaw, denominatorNumber: row.denominatorNumber, denominatorYear: row.denominatorYear, denominatorSource: row.denominatorSource, finalRaw: row.finalRaw, finalNumber: row.finalNumber, finalFormula: row.finalFormula, numeratorFormula: row.numeratorFormula, denominatorFormula: row.denominatorFormula, sourceLabel: 'Importado de Indicadores_ABNT.xlsx' };
  if (!current) await prisma.indicatorValue.create({ data: { indicatorId: indicator.id, ...valueData } });
  else if (current.validationState !== 'VALIDATED') await prisma.indicatorValue.update({ where: { id: current.id }, data: valueData });
  await prisma.indicatorHistory.create({ data: { indicatorId: indicator.id, action: 'SEED_SYNC', actor: 'Sistema', details: { source: 'Indicadores_ABNT.xlsx', row: row.sourceRow } } });
  imported++;
}

await prisma.auxiliaryIndicator.deleteMany();
for (const row of seed.auxiliary) {
  let relatedIndicatorId = null;
  for (const rel of row.related || []) { const candidate = indicatorKeyToId.get(`${rel.standard}:${rel.code}`); if (candidate) { relatedIndicatorId = candidate; break; } }
  await prisma.auxiliaryIndicator.create({ data: { code: row.code, name: row.name, category: row.category, available: row.available, valueRaw: row.valueRaw, valueNumber: row.valueNumber, referenceDate: row.referenceDate, sourceLabel: 'Importado de indicadores_auxiliares.csv', sourceRow: row.sourceRow, relatedIndicatorId } });
}

console.log(`Seed concluído: ${imported} indicadores ABNT e ${seed.auxiliary.length} indicadores auxiliares.`);
await prisma.$disconnect();
