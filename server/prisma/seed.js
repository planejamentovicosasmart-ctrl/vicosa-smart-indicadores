import '../src/lib/env.js';
import fs from 'node:fs/promises';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');

const basePartNames = ['seed.gz.b64.part1.txt','seed.gz.b64.part2.txt','seed.gz.b64.part3.txt','seed.gz.b64.part4.txt'];
const base64 = (await Promise.all(basePartNames.map((name) => fs.readFile(path.join(dataDir, name), 'utf8')))).join('').trim();
const baseSeed = JSON.parse(gunzipSync(Buffer.from(base64, 'base64')).toString('utf8'));

const supplementPartNames = ['catalog-supplement.br.b64.part1.txt','catalog-supplement.br.b64.part2.txt'];
let supplement = { catalogIndicators: [], missingIndicators: [], valueOverlays: [], auxiliary: baseSeed.auxiliary || [] };
try {
  supplement = JSON.parse(await fs.readFile(path.join(dataDir, 'catalog-supplement.json'), 'utf8'));
  console.log('[seed] Suplemento JSON carregado:', supplement.meta?.counts || {});
} catch (jsonError) {
  try {
    const supplementBase64 = (await Promise.all(supplementPartNames.map((name) => fs.readFile(path.join(dataDir, name), 'utf8')))).join('').trim();
    supplement = JSON.parse(brotliDecompressSync(Buffer.from(supplementBase64, 'base64')).toString('utf8'));
    console.warn('[seed] Usando suplemento comprimido legado.');
  } catch (legacyError) {
    console.warn('Suplemento de catálogo não encontrado; usando apenas a base detalhada original.', legacyError.message);
  }
}

const standardsMeta = {
  '37120': { title: 'ISO 37120', subtitle: 'Cidades Sustentáveis', description: 'Indicadores para serviços urbanos e qualidade de vida.' },
  '37122': { title: 'ISO 37122', subtitle: 'Cidades Inteligentes', description: 'Indicadores para cidades inteligentes e uso de tecnologia.' },
  '37123': { title: 'ISO 37123', subtitle: 'Cidades Resilientes', description: 'Indicadores de resiliência urbana e preparação para riscos.' },
};

function hasValue(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function normalizeYear(value) {
  if (!hasValue(value)) return null;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 1900 && n <= 2200) return String(Math.trunc(n));
  return String(value).trim();
}
function rowPresence(row) {
  const hasN = hasValue(row.numeratorRaw) || row.numeratorNumber !== null && row.numeratorNumber !== undefined;
  const hasD = hasValue(row.denominatorRaw) || row.denominatorNumber !== null && row.denominatorNumber !== undefined;
  const hasF = hasValue(row.finalRaw) || row.finalNumber !== null && row.finalNumber !== undefined;
  return { hasN, hasD, hasF, hasAny: hasN || hasD || hasF, hasComplete: hasF || (hasN && hasD) };
}
function statusOf(row) {
  const { hasN, hasD, hasF, hasComplete } = rowPresence(row);
  if (row.status === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
  if (row.unit === '%' && row.finalNumber != null && (row.finalNumber < 0 || row.finalNumber > 100)) return 'REVIEW_NEEDED';
  if (normalizeYear(row.numeratorYear) && normalizeYear(row.denominatorYear) && normalizeYear(row.numeratorYear) !== normalizeYear(row.denominatorYear)) return 'REVIEW_NEEDED';

  // A equipe autorizou, em 02/10/2026, tratar os dados já fornecidos nas bases
  // de trabalho como corretos. Dados completos importados passam a ser validados;
  // somente lacunas/parciais permanecem na fila de pesquisa.
  if (hasComplete) return 'VALIDATED';
  if (hasN || hasD) return 'PARTIAL';

  if ((row.notes || '').toLowerCase().includes('solicitar')) return 'NEEDS_REQUEST';
  if (row.status === 'IN_RESEARCH') return 'IN_RESEARCH';
  return 'NOT_STARTED';
}
function priorityOf(row) {
  const status = statusOf(row);
  if (status === 'PARTIAL') return 100;
  if (status === 'NOT_STARTED') return 95;
  if (status === 'REVIEW_NEEDED') return 90;
  if (status === 'NEEDS_REQUEST') return 80;
  if (status === 'IN_RESEARCH') return 75;
  return 10;
}

const mergedMap = new Map((baseSeed.indicators || []).map((row) => [`${row.standard}:${row.code}`, { ...row }]));
const catalogRows = supplement.catalogIndicators?.length ? supplement.catalogIndicators : (supplement.missingIndicators || []);
for (const row of catalogRows) {
  const key = `${row.standard}:${row.code}`;
  const detailed = mergedMap.get(key);
  // Preserve the richer metadata from Indicadores_ABNT(1).xlsx when it exists.
  mergedMap.set(key, detailed ? { ...row, ...detailed } : { ...row });
}
for (const overlay of supplement.valueOverlays || []) {
  const key = `${overlay.standard}:${overlay.code}`;
  const current = mergedMap.get(key);
  if (current) mergedMap.set(key, { ...current, ...overlay });
}
const indicators = [...mergedMap.values()];

const standardByCode = {};
for (const code of Object.keys(standardsMeta)) {
  const meta = standardsMeta[code];
  standardByCode[code] = await prisma.standard.upsert({ where: { code }, update: meta, create: { code, ...meta } });
}

const indicatorKeyToId = new Map();
let imported = 0;
for (const row of indicators) {
  const standard = standardByCode[row.standard];
  if (!standard || !row.code || !row.name) continue;
  const desiredStatus = statusOf(row);
  const existing = await prisma.indicator.findUnique({ where: { standardId_code: { standardId: standard.id, code: row.code } } });
  const indicator = await prisma.indicator.upsert({
    where: { standardId_code: { standardId: standard.id, code: row.code } },
    update: {
      name: row.name,
      numeratorDescription: row.numeratorDescription || undefined,
      denominatorDescription: row.denominatorDescription || undefined,
      unit: row.unit || undefined,
      notes: row.notes || undefined,
      sourceRow: row.sourceRow || undefined,
      priority: priorityOf(row),
      ...(existing?.status === 'VALIDATED' ? {} : { status: desiredStatus }),
    },
    create: {
      standardId: standard.id,
      code: row.code,
      name: row.name,
      numeratorDescription: row.numeratorDescription || null,
      denominatorDescription: row.denominatorDescription || null,
      unit: row.unit || null,
      notes: row.notes || null,
      status: desiredStatus,
      sourceRow: row.sourceRow || null,
      priority: priorityOf(row),
    },
  });
  indicatorKeyToId.set(`${row.standard}:${row.code}`, indicator.id);

  const current = await prisma.indicatorValue.findFirst({ where: { indicatorId: indicator.id, isCurrent: true }, orderBy: { createdAt: 'desc' } });
  const valueData = {
    numeratorRaw: row.numeratorRaw || null,
    numeratorNumber: row.numeratorNumber ?? null,
    numeratorYear: normalizeYear(row.numeratorYear),
    numeratorSource: row.numeratorSource || null,
    denominatorRaw: row.denominatorRaw || null,
    denominatorNumber: row.denominatorNumber ?? null,
    denominatorYear: normalizeYear(row.denominatorYear),
    denominatorSource: row.denominatorSource || null,
    finalRaw: row.finalRaw || null,
    finalNumber: row.finalNumber ?? null,
    finalFormula: row.finalFormula || null,
    numeratorFormula: row.numeratorFormula || null,
    denominatorFormula: row.denominatorFormula || null,
    sourceLabel: row.sourceLabel || (row.sourceRow && row.sourceRow <= 30 ? 'Importado de Indicadores_ABNT(1).xlsx' : 'Catálogo consolidado das bases fornecidas'),
  };
  const presence = rowPresence(row);
  const hasAnyValue = presence.hasAny;
  const trustedImported = desiredStatus === 'VALIDATED';
  const validationData = trustedImported ? {
    validationState: 'VALIDATED',
    validatedAt: new Date(),
    validatedBy: 'Equipe Viçosa SMART · base fornecida',
  } : {};

  if (hasAnyValue && !current) {
    await prisma.indicatorValue.create({ data: { indicatorId: indicator.id, ...valueData, ...validationData } });
  } else if (hasAnyValue && current && current.validationState !== 'VALIDATED') {
    await prisma.indicatorValue.update({ where: { id: current.id }, data: { ...valueData, ...validationData } });
  }

  const priorSync = await prisma.indicatorHistory.findFirst({ where: { indicatorId: indicator.id, action: 'SEED_SYNC' } });
  if (!priorSync) await prisma.indicatorHistory.create({ data: { indicatorId: indicator.id, action: 'SEED_SYNC', actor: 'Sistema', details: { source: row.sourceLabel || 'Bases fornecidas', row: row.sourceRow || null } } });
  imported++;
}

await prisma.auxiliaryIndicator.deleteMany();
for (const row of supplement.auxiliary || []) {
  let relatedIndicatorId = null;
  for (const rel of row.related || []) {
    const candidate = indicatorKeyToId.get(`${rel.standard}:${rel.code}`);
    if (candidate) { relatedIndicatorId = candidate; break; }
  }
  await prisma.auxiliaryIndicator.create({ data: {
    code: row.code || null,
    name: row.name,
    category: row.category || 'Outros',
    available: row.available ?? null,
    valueRaw: row.valueRaw || null,
    valueNumber: row.valueNumber ?? null,
    referenceDate: row.referenceDate || null,
    sourceLabel: 'Base auxiliar fornecida',
    sourceRow: row.sourceRow || null,
    relatedIndicatorId,
  } });
}

const counts = indicators.reduce((acc, row) => ((acc[row.standard] = (acc[row.standard] || 0) + 1), acc), {});
console.log(`Seed concluído: ${imported} indicadores ABNT/ISO — 37120=${counts['37120'] || 0}, 37122=${counts['37122'] || 0}, 37123=${counts['37123'] || 0}; ${supplement.auxiliary?.length || 0} auxiliares.`);
await prisma.$disconnect();
