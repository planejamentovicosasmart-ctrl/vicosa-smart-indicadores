import { prisma } from '../lib/prisma.js';
import { cleanUrl, deriveIndicatorStatus } from '../utils/indicator.js';

const OFFICIAL_HINTS = [
  'gov.br', 'ibge.gov.br', 'sidra.ibge.gov.br', 'cidades.gov.br', 'datasus.gov.br',
  'inep.gov.br', 'tesouro.gov.br', 'tse.jus.br', 'aneel.gov.br', 'anatel.gov.br',
  'mg.gov.br', 'vicosa.mg.gov.br', 'saaevicosa.mg.gov.br', 'ufv.br',
  'sinisa.gov.br', 'snis.gov.br', 'cidades.ibge.gov.br', 'dados.gov.br',
];

const SOURCE_PRIORITY = [
  'Prefeitura Municipal de Viçosa', 'SAAE Viçosa', 'IBGE / SIDRA', 'SINISA', 'dados.gov.br',
  'DATASUS', 'INEP', 'CECAD / CadÚnico', 'Tesouro Nacional / SICONFI', 'TSE', 'ANEEL', 'ANATEL',
  'Governo de Minas Gerais', 'UFV', 'outros documentos institucionais',
];

function isOfficialUrl(url = '') {
  const low = url.toLowerCase();
  return OFFICIAL_HINTS.some((d) => low.includes(d));
}

function extractOutputText(json) {
  if (typeof json?.output_text === 'string') return json.output_text;
  const chunks = [];
  for (const item of json?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content?.text) chunks.push(content.text);
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n');
}

function parseJsonLoose(text) {
  if (!text) return null;
  const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(clean); } catch {}
  const starts = ['[', '{'].map((c) => clean.indexOf(c)).filter((i) => i >= 0);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  for (let end = clean.length; end > start; end--) {
    try { return JSON.parse(clean.slice(start, end)); } catch {}
  }
  return null;
}

function normalizeFinding(raw, targetFallback) {
  if (!raw || typeof raw !== 'object') return null;
  const sourceUrl = cleanUrl(raw.sourceUrl || raw.url);
  const candidateValueRaw = raw.candidateValueRaw == null ? null : String(raw.candidateValueRaw).trim();
  const numeric = raw.candidateValueNumber == null ? Number(candidateValueRaw?.replace(/\./g, '').replace(',', '.')) : Number(raw.candidateValueNumber);
  const hasNumeric = Number.isFinite(numeric);
  const official = isOfficialUrl(sourceUrl || '');
  let score = Number(raw.confidenceScore);
  if (!Number.isFinite(score)) score = official ? 78 : 48;
  if (!sourceUrl) score -= 18;
  if (!raw.evidenceExcerpt) score -= 10;
  if (!candidateValueRaw && !hasNumeric) score -= 8;
  score = Math.max(10, Math.min(95, Math.round(score)));
  const confidenceLevel = score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';
  return {
    targetField: String(raw.targetField || targetFallback || 'SOURCE').toUpperCase(),
    candidateValueRaw: candidateValueRaw || null,
    candidateValueNumber: hasNumeric ? numeric : null,
    unit: raw.unit ? String(raw.unit) : null,
    referenceYear: raw.referenceYear ? String(raw.referenceYear) : null,
    sourceName: String(raw.sourceName || raw.sourceOrganization || 'Fonte encontrada').slice(0, 300),
    sourceOrganization: raw.sourceOrganization ? String(raw.sourceOrganization).slice(0, 300) : null,
    sourceType: raw.sourceType ? String(raw.sourceType).slice(0, 120) : (official ? 'Fonte oficial' : 'Fonte a revisar'),
    sourceUrl,
    evidenceExcerpt: raw.evidenceExcerpt ? String(raw.evidenceExcerpt).slice(0, 2400) : null,
    evidenceDocument: raw.evidenceDocument ? String(raw.evidenceDocument).slice(0, 500) : null,
    evidencePage: raw.evidencePage ? String(raw.evidencePage).slice(0, 100) : null,
    confidenceLevel,
    confidenceScore: score,
    confidenceReason: raw.confidenceReason ? String(raw.confidenceReason).slice(0, 900) : (official ? 'URL associada a domínio institucional/oficial.' : 'Fonte necessita revisão humana.'),
    rawPayload: raw,
  };
}

function researchTargets(indicator, value) {
  const auditMode = indicator.status === 'AWAITING_VALIDATION' || value?.origin === 'VICOSA_SMART';
  if (auditMode) return ['AUDIT'];

  const targets = [];
  const hasN = Boolean(value?.numeratorRaw || value?.numeratorNumber !== null && value?.numeratorNumber !== undefined);
  const hasD = Boolean(value?.denominatorRaw || value?.denominatorNumber !== null && value?.denominatorNumber !== undefined);
  const hasF = Boolean(value?.finalRaw || value?.finalNumber !== null && value?.finalNumber !== undefined);
  if (!hasF) targets.push('FINAL');
  if (!hasN && indicator.numeratorDescription) targets.push('NUMERATOR');
  if (!hasD && indicator.denominatorDescription) targets.push('DENOMINATOR');
  if (!targets.length) targets.push('UPDATE');
  return targets;
}

async function researchWithOpenAI(indicator, value, targets, hint = null) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-5.6-sol';
  const current = {
    origin: value?.origin || null,
    numerator: { value: value?.numeratorRaw, year: value?.numeratorYear, source: value?.numeratorSource },
    denominator: { value: value?.denominatorRaw, year: value?.denominatorYear, source: value?.denominatorSource },
    final: { value: value?.finalRaw, year: value?.finalYear, source: value?.finalSource },
  };
  const auditMode = targets.includes('AUDIT');
  const system = `Você é um copiloto de auditoria e pesquisa de indicadores municipais para ABNT NBR ISO 37120, 37122 e 37123. Sua função é INVESTIGAR e AUDITAR CANDIDATOS, nunca homologar automaticamente. Nunca invente valores, fontes, URLs, anos ou trechos. Use pesquisa web e priorize fontes oficiais. Se não houver dado comprovável, retorne apenas pistas de fonte ou nenhum achado. Não trate snippet de buscador como evidência final. A cidade é Viçosa/MG, Brasil. Prioridade de fontes: ${SOURCE_PRIORITY.join(' > ')}. Quando estiver auditando um valor do Viçosa SMART, compare explicitamente valor, ano, conceito, numerador, denominador e unidade com a evidência encontrada e descreva divergências no confidenceReason. Retorne SOMENTE JSON válido no formato {"findings":[...]}. Cada finding: targetField (AUDIT|NUMERATOR|DENOMINATOR|FINAL|UPDATE|SOURCE), candidateValueRaw, candidateValueNumber, unit, referenceYear, sourceName, sourceOrganization, sourceType, sourceUrl, evidenceExcerpt, evidenceDocument, evidencePage, confidenceScore, confidenceReason. confidenceScore deve refletir evidência verificável, não opinião.`;
  const user = `Norma: ISO ${indicator.standard.code}
Código: ${indicator.code}
Indicador: ${indicator.name}
Descrição/contexto cadastrado: ${indicator.description || 'não informado'}
Numerador necessário: ${indicator.numeratorDescription || 'não informado'}
Denominador necessário: ${indicator.denominatorDescription || 'não informado'}
Unidade esperada: ${indicator.unit || 'confirmar na fonte'}
Modo: ${auditMode ? 'AUDITORIA DE CANDIDATO EXISTENTE' : 'PESQUISA DE LACUNA'}
Campos a investigar: ${targets.join(', ')}
Dados já existentes: ${JSON.stringify(current)}
Observações existentes: ${indicator.notes || 'nenhuma'}
Pista/observação fornecida pelo usuário: ${hint || 'nenhuma'}

${auditMode
  ? 'Audite o candidato existente do Viçosa SMART. Procure evidência oficial independente e diga, no confidenceReason, se o candidato parece coerente, parcialmente coerente ou divergente. Não altere nem aprove o dado.'
  : 'Pesquise dados municipais de Viçosa/MG. Tente primeiro localizar o resultado final oficial; se não existir, procure os componentes necessários para o cálculo.'}
Para cada achado, exija URL exata e trecho que comprove o dado, o município e o ano. Dê preferência ao dado oficial mais recente disponível. Se a fonte publicar diretamente o resultado final do indicador, use targetField FINAL. Quando o cálculo for necessário, prefira numerador e denominador do mesmo ano. Se encontrar apenas uma página candidata, use SOURCE sem inventar valor.`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search' }],
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        { role: 'user', content: [{ type: 'input_text', text: user }] },
      ],
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`OpenAI: ${json?.error?.message || response.statusText}`);
  const parsed = parseJsonLoose(extractOutputText(json));
  const rows = Array.isArray(parsed) ? parsed : parsed?.findings;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => normalizeFinding(row, targets[0])).filter(Boolean);
}

async function researchWithTavily(indicator, targets, hint = null) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  const queries = targets.slice(0, 2).map((target) => {
    const field = target === 'NUMERATOR' ? indicator.numeratorDescription : target === 'DENOMINATOR' ? indicator.denominatorDescription : indicator.name;
    return `Viçosa MG ${field || indicator.name} ${indicator.standard.code} fonte oficial ${hint || ''}`.trim();
  });
  const findings = [];
  for (const query of queries) {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: 'advanced', max_results: 6, include_answer: false }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(`Tavily: ${json?.detail || response.statusText}`);
    for (const item of json.results || []) {
      const normalized = normalizeFinding({
        targetField: 'SOURCE',
        sourceName: item.title || 'Fonte candidata',
        sourceUrl: item.url,
        evidenceExcerpt: item.content,
        confidenceScore: isOfficialUrl(item.url) ? 62 : 36,
        confidenceReason: isOfficialUrl(item.url) ? 'Fonte candidata em domínio institucional; o valor ainda precisa ser extraído e validado.' : 'Pista de pesquisa; revisar a fonte antes de usar.',
      }, 'SOURCE');
      if (normalized) findings.push(normalized);
    }
  }
  return findings;
}

async function createFindingIfNew(indicatorId, runId, finding) {
  const duplicate = await prisma.agentFinding.findFirst({
    where: {
      indicatorId,
      targetField: finding.targetField,
      sourceUrl: finding.sourceUrl,
      referenceYear: finding.referenceYear,
      candidateValueRaw: finding.candidateValueRaw,
      status: { not: 'REJECTED' },
    },
  });
  if (duplicate) return { created: false, item: duplicate };
  const item = await prisma.agentFinding.create({ data: { indicatorId, agentRunId: runId, ...finding } });
  if (finding.sourceUrl || finding.evidenceExcerpt) {
    await prisma.evidence.create({
      data: {
        indicatorId,
        findingId: item.id,
        title: finding.sourceName,
        organization: finding.sourceOrganization,
        url: finding.sourceUrl,
        documentName: finding.evidenceDocument,
        page: finding.evidencePage,
        excerpt: finding.evidenceExcerpt,
        accessedAt: new Date(),
      },
    });
  }
  return { created: true, item };
}

async function researchOne(indicator, runId, hint = null) {
  const value = indicator.values?.[0] || null;
  const targets = researchTargets(indicator, value);
  let provider = 'none';
  let rawFindings = await researchWithOpenAI(indicator, value, targets, hint);
  if (rawFindings !== null) provider = 'openai-web';
  if (rawFindings === null) {
    rawFindings = await researchWithTavily(indicator, targets, hint);
    if (rawFindings !== null) provider = 'tavily';
  }
  if (rawFindings === null) throw new Error('Agente não configurado. Defina OPENAI_API_KEY ou TAVILY_API_KEY.');

  let created = 0;
  for (const finding of rawFindings.slice(0, 10)) {
    const result = await createFindingIfNew(indicator.id, runId, finding);
    if (result.created) created++;
  }
  const existingFindings = await prisma.agentFinding.findMany({ where: { indicatorId: indicator.id }, select: { status: true } });
  const status = targets.includes('AUDIT')
    ? 'AWAITING_VALIDATION'
    : deriveIndicatorStatus(value, existingFindings);
  await prisma.indicator.update({
    where: { id: indicator.id },
    data: {
      searchAttempts: { increment: 1 },
      lastSearchedAt: new Date(),
      status,
      nextSearchAt: new Date(Date.now() + (created ? 7 : 21) * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.indicatorHistory.create({ data: { indicatorId: indicator.id, action: 'AGENT_RESEARCH', actor: 'Agente', details: { provider, targets, created } } });
  return { created, provider, targets };
}

export async function runResearchBatch({ indicatorId = null, mode = 'all', hint = null } = {}) {
  const run = await prisma.agentRun.create({ data: { status: 'RUNNING', summary: `Execução ${mode}` } });
  let checked = 0, created = 0, errors = 0, sourcesFound = 0;
  const messages = [];
  try {
    const max = Math.max(1, Math.min(30, Number(process.env.AGENT_MAX_INDICATORS || 8)));
    const statusByMode = mode === 'audit'
      ? ['AWAITING_VALIDATION']
      : mode === 'search'
        ? ['NOT_STARTED', 'PARTIAL', 'NEEDS_REQUEST', 'REVIEW_NEEDED', 'IN_RESEARCH']
        : ['AWAITING_VALIDATION', 'NOT_STARTED', 'PARTIAL', 'NEEDS_REQUEST', 'REVIEW_NEEDED', 'IN_RESEARCH'];
    const where = indicatorId ? { id: indicatorId } : {
      status: { in: statusByMode },
      OR: [{ nextSearchAt: null }, { nextSearchAt: { lte: new Date() } }],
    };
    const indicators = await prisma.indicator.findMany({
      where,
      include: { standard: true, values: { where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
      take: indicatorId ? 1 : max,
    });
    for (const indicator of indicators) {
      checked++;
      try {
        const result = await researchOne(indicator, run.id, hint);
        created += result.created;
        sourcesFound += result.created;
        messages.push(`${indicator.standard.code} ${indicator.code}: ${result.created} descoberta(s)`);
      } catch (error) {
        errors++;
        messages.push(`${indicator.standard.code} ${indicator.code}: ${error.message}`);
        if (/não configurado/i.test(error.message)) break;
      }
    }
    const finalStatus = errors && created ? 'PARTIAL' : errors ? 'FAILED' : 'COMPLETED';
    const summary = checked === 0
      ? 'Nenhum indicador elegível para pesquisa neste momento.'
      : `${checked} indicador(es) analisado(s), ${created} nova(s) descoberta(s), ${errors} erro(s).`;
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: finalStatus, indicatorsChecked: checked, sourcesFound, candidatesCreated: created, errorsCount: errors, summary, error: errors ? messages.join('\n').slice(0, 5000) : null },
    });
    return { runId: run.id, status: finalStatus, checked, created, errors, summary, messages };
  } catch (error) {
    await prisma.agentRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), status: 'FAILED', indicatorsChecked: checked, candidatesCreated: created, errorsCount: errors + 1, error: error.message } });
    throw error;
  }
}
