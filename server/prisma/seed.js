import '../src/lib/env.js';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');

const basePartNames = ['seed.gz.b64.part1.txt','seed.gz.b64.part2.txt','seed.gz.b64.part3.txt','seed.gz.b64.part4.txt'];
const base64 = (await Promise.all(basePartNames.map((name) => fs.readFile(path.join(dataDir, name), 'utf8')))).join('').trim();
const baseSeed = JSON.parse(gunzipSync(Buffer.from(base64, 'base64')).toString('utf8'));
const canonical = JSON.parse(await fs.readFile(path.join(dataDir, 'canonical-sources.json'), 'utf8'));

const standardsMeta = {
  '37120': { title: 'ISO 37120', subtitle: 'Cidades Sustentáveis', description: 'Indicadores para serviços urbanos e qualidade de vida.' },
  '37122': { title: 'ISO 37122', subtitle: 'Cidades Inteligentes', description: 'Indicadores para cidades inteligentes e uso de tecnologia.' },
  '37123': { title: 'ISO 37123', subtitle: 'Cidades Resilientes', description: 'Indicadores de resiliência urbana e preparação para riscos.' },
};

function hasValue(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}
function normalizeYear(value) {
  if (!hasValue(value)) return null;
  const s = String(value).trim();
  const m = s.match(/(19|20|21)\d{2}/);
  return m ? m[0] : s.replace(/\.0$/, '');
}
function seedManaged(value) {
  if (!value) return false;
  const label = String(value.sourceLabel || '').toLowerCase();
  const validator = String(value.validatedBy || '').toLowerCase();
  return ['GETERR','VICOSA_SMART','SEED'].includes(String(value.origin || '').toUpperCase())
    || validator.includes('base fornecida')
    || label.includes('geterr')
    || label.includes('catálogo consolidado')
    || label.includes('catalogo consolidado')
    || label.includes('importado de indicadores_abnt')
    || label.includes('base fornecida')
    || label.includes('viçosa smart — candidato')
    || label.includes('vicosa smart — candidato');
}
function present(row) {
  const hasN = hasValue(row.numeratorRaw) || row.numeratorNumber !== null && row.numeratorNumber !== undefined;
  const hasD = hasValue(row.denominatorRaw) || row.denominatorNumber !== null && row.denominatorNumber !== undefined;
  const hasF = hasValue(row.finalRaw) || row.finalNumber !== null && row.finalNumber !== undefined;
  return { hasN, hasD, hasF, any: hasN || hasD || hasF, complete: hasF || (hasN && hasD) };
}
function desiredPriority(status) {
  if (status === 'AWAITING_VALIDATION') return 100;
  if (status === 'PARTIAL' || status === 'REVIEW_NEEDED') return 95;
  if (status === 'NOT_STARTED') return 90;
  if (status === 'NEEDS_REQUEST') return 82;
  if (status === 'IN_RESEARCH') return 78;
  if (status === 'COMPLETE') return 25;
  if (status === 'VALIDATED') return 10;
  return 50;
}
function metadataOnly(row) {
  if (!row) return {};
  return {
    description: row.description || null,
    numeratorDescription: row.numeratorDescription || null,
    denominatorDescription: row.denominatorDescription || null,
    unit: row.unit || null,
    formula: row.formula || null,
    finalFormula: row.finalFormula || null,
    numeratorFormula: row.numeratorFormula || null,
    denominatorFormula: row.denominatorFormula || null,
  };
}

const detailedMap = new Map((baseSeed.indicators || []).map((row) => [`${row.standard}:${row.code}`, row]));
const foundMap = new Map((canonical.geterrFound || []).map((row) => [`${row.standard}:${row.code}`, row]));
const teamMap = new Map((canonical.teamCandidates || []).map((row) => [`${row.standard}:${row.code}`, row]));

const rows = (canonical.catalog || []).map((catalogRow) => {
  const key = `${catalogRow.standard}:${catalogRow.code}`;
  const detailed = detailedMap.get(key);
  const found = foundMap.get(key);
  const team = teamMap.get(key);
  const meta = metadataOnly(detailed);
  const base = {
    ...catalogRow,
    ...meta,
    name: catalogRow.name || detailed?.name,
    description: catalogRow.description || meta.description || null,
    notes: null,
    numeratorRaw: null,
    numeratorNumber: null,
    numeratorYear: null,
    numeratorSource: null,
    numeratorSourceUrl: null,
    denominatorRaw: null,
    denominatorNumber: null,
    denominatorYear: null,
    denominatorSource: null,
    denominatorSourceUrl: null,
    finalRaw: null,
    finalNumber: null,
    finalYear: null,
    finalSource: null,
    finalSourceUrl: null,
    origin: null,
    sourceLabel: catalogRow.sourceLabel || null,
    status: catalogRow.status || 'NOT_STARTED',
  };

  if (found) {
    Object.assign(base, {
      finalRaw: found.finalRaw || null,
      finalNumber: found.finalNumber ?? null,
      finalYear: normalizeYear(found.finalYear),
      finalSource: 'Geterr',
      origin: 'GETERR',
      sourceLabel: 'Geterr — encontrado',
      status: 'COMPLETE',
      notes: 'Indicador localizado na planilha geterr_encontrado. Somente itens pertencentes às normas ABNT NBR ISO 37120, 37122 e 37123 são importados.',
    });
  }

  if (team) {
    const sameYear = normalizeYear(team.numeratorYear) && normalizeYear(team.numeratorYear) === normalizeYear(team.denominatorYear)
      ? normalizeYear(team.numeratorYear) : null;
    Object.assign(base, {
      numeratorDescription: team.numeratorDescription || base.numeratorDescription,
      denominatorDescription: team.denominatorDescription || base.denominatorDescription,
      numeratorRaw: team.numeratorRaw || null,
      numeratorNumber: team.numeratorNumber ?? null,
      numeratorYear: normalizeYear(team.numeratorYear),
      numeratorSource: team.numeratorSource || null,
      numeratorSourceUrl: /^https?:\/\//i.test(String(team.numeratorSource || '').trim()) ? String(team.numeratorSource).trim() : null,
      denominatorRaw: team.denominatorRaw || null,
      denominatorNumber: team.denominatorNumber ?? null,
      denominatorYear: normalizeYear(team.denominatorYear),
      denominatorSource: team.denominatorSource || null,
      denominatorSourceUrl: /^https?:\/\//i.test(String(team.denominatorSource || '').trim()) ? String(team.denominatorSource).trim() : null,
      finalRaw: team.finalRaw || null,
      finalNumber: team.finalNumber ?? null,
      finalYear: sameYear,
      finalSource: null,
      origin: 'VICOSA_SMART',
      sourceLabel: 'Levantamento Viçosa SMART — candidato',
      status: team.status || 'AWAITING_VALIDATION',
      notes: [
        'Levantamento realizado pela equipe Viçosa SMART. O dado ainda precisa ser auditado antes de ser tratado como evidência para certificação ABNT.',
        team.notes || null,
      ].filter(Boolean).join(' '),
    });
  }
  return base;
});

if (rows.length !== 269) throw new Error(`Catálogo canônico inválido: esperado 269, recebido ${rows.length}`);

const standardByCode = {};
for (const code of Object.keys(standardsMeta)) {
  const meta = standardsMeta[code];
  standardByCode[code] = await prisma.standard.upsert({ where: { code }, update: meta, create: { code, ...meta } });
}

const canonicalIds = [];
let imported = 0;
for (const row of rows) {
  const standard = standardByCode[row.standard];
  if (!standard || !row.code || !row.name) continue;

  const existing = await prisma.indicator.findUnique({
    where: { standardId_code: { standardId: standard.id, code: row.code } },
    include: { values: { where: { isCurrent: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const current = existing?.values?.[0] || null;
  const preserveHumanValidated = Boolean(current && current.validationState === 'VALIDATED' && !seedManaged(current));
  const status = preserveHumanValidated ? 'VALIDATED' : row.status;

  const indicator = await prisma.indicator.upsert({
    where: { standardId_code: { standardId: standard.id, code: row.code } },
    update: {
      name: row.name,
      description: row.description || undefined,
      numeratorDescription: row.numeratorDescription || undefined,
      denominatorDescription: row.denominatorDescription || undefined,
      unit: row.unit || undefined,
      formula: row.formula || undefined,
      notes: row.notes || undefined,
      sourceRow: row.sourceRow || undefined,
      priority: desiredPriority(status),
      status,
    },
    create: {
      standardId: standard.id,
      code: row.code,
      name: row.name,
      description: row.description || null,
      numeratorDescription: row.numeratorDescription || null,
      denominatorDescription: row.denominatorDescription || null,
      unit: row.unit || null,
      formula: row.formula || null,
      notes: row.notes || null,
      status,
      sourceRow: row.sourceRow || null,
      priority: desiredPriority(status),
    },
  });
  canonicalIds.push(indicator.id);

  if (!preserveHumanValidated) {
    const p = present(row);
    if (p.any) {
      const valueData = {
        numeratorRaw: row.numeratorRaw || null,
        numeratorNumber: row.numeratorNumber ?? null,
        numeratorYear: normalizeYear(row.numeratorYear),
        numeratorSource: row.numeratorSource || null,
        numeratorSourceUrl: row.numeratorSourceUrl || null,
        denominatorRaw: row.denominatorRaw || null,
        denominatorNumber: row.denominatorNumber ?? null,
        denominatorYear: normalizeYear(row.denominatorYear),
        denominatorSource: row.denominatorSource || null,
        denominatorSourceUrl: row.denominatorSourceUrl || null,
        finalRaw: row.finalRaw || null,
        finalNumber: row.finalNumber ?? null,
        finalYear: normalizeYear(row.finalYear),
        finalSource: row.finalSource || null,
        finalSourceUrl: row.finalSourceUrl || null,
        finalFormula: row.finalFormula || null,
        numeratorFormula: row.numeratorFormula || null,
        denominatorFormula: row.denominatorFormula || null,
        origin: row.origin || 'SEED',
        sourceLabel: row.sourceLabel || null,
        validationState: 'IMPORTED',
        validatedAt: null,
        validatedBy: null,
        isCurrent: true,
      };
      if (current && seedManaged(current)) {
        await prisma.indicatorValue.update({ where: { id: current.id }, data: valueData });
      } else if (!current) {
        await prisma.indicatorValue.create({ data: { indicatorId: indicator.id, ...valueData } });
      } else {
        await prisma.indicatorValue.update({ where: { id: current.id }, data: { isCurrent: false, validationState: 'SUPERSEDED' } });
        await prisma.indicatorValue.create({ data: { indicatorId: indicator.id, ...valueData } });
      }
    } else if (current && seedManaged(current)) {
      await prisma.indicatorValue.update({
        where: { id: current.id },
        data: { isCurrent: false, validationState: 'SUPERSEDED' },
      });
    }
  }

  const priorSync = await prisma.indicatorHistory.findFirst({ where: { indicatorId: indicator.id, action: 'CANONICAL_V2_SYNC' } });
  if (!priorSync) {
    await prisma.indicatorHistory.create({
      data: {
        indicatorId: indicator.id,
        action: 'CANONICAL_V2_SYNC',
        actor: 'Sistema',
        details: { source: row.sourceLabel || 'Catálogo canônico', version: canonical.meta?.version || null },
      },
    });
  }
  imported++;
}

// A base oficial deve conter somente os 269 indicadores pertencentes às três normas.
await prisma.indicator.deleteMany({ where: { id: { notIn: canonicalIds } } });

// A guia "Indicadores auxiliares" agora é derivada dos numeradores/denominadores
// dos próprios indicadores, sem importar os indicadores genéricos da Geterr.
await prisma.auxiliaryIndicator.deleteMany();

const statusGroups = await prisma.indicator.groupBy({ by: ['status'], _count: { _all: true } });
const statusSummary = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));
const originGroups = await prisma.indicatorValue.groupBy({ by: ['origin'], where: { isCurrent: true }, _count: { _all: true } });
const originSummary = Object.fromEntries(originGroups.map((g) => [g.origin || 'SEM_ORIGEM', g._count._all]));
console.log('[seed] Catálogo canônico:', canonical.meta?.counts || {});
console.log(`Seed concluído: ${imported} indicadores ABNT/ISO; auxiliares dinâmicos por numerador/denominador.`);
console.log('[seed] Status:', statusSummary);
console.log('[seed] Origens atuais:', originSummary);
await prisma.$disconnect();
