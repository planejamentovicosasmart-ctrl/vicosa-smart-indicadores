export const STATUS_LABELS = {
  NOT_STARTED: 'Não iniciado',
  IN_RESEARCH: 'Em pesquisa',
  PARTIAL: 'Parcial',
  COMPLETE: 'Completo',
  AWAITING_VALIDATION: 'Aguardando validação',
  VALIDATED: 'Validado',
  NEEDS_REQUEST: 'Necessita solicitação',
  NOT_APPLICABLE: 'Não aplicável',
  REVIEW_NEEDED: 'Revisão necessária',
};

export function deriveIndicatorStatus(value, findings = []) {
  if (value?.validationState === 'VALIDATED') return 'VALIDATED';
  if (findings.some((f) => f.status === 'AWAITING_VALIDATION' || f.status === 'ACCEPTED')) return 'AWAITING_VALIDATION';
  const hasNumerator = Boolean(value?.numeratorRaw || value?.numeratorNumber !== null && value?.numeratorNumber !== undefined);
  const hasDenominator = Boolean(value?.denominatorRaw || value?.denominatorNumber !== null && value?.denominatorNumber !== undefined);
  const hasFinal = Boolean(value?.finalRaw || value?.finalNumber !== null && value?.finalNumber !== undefined);
  if (hasFinal || (hasNumerator && hasDenominator)) return 'COMPLETE';
  if (hasNumerator || hasDenominator) return 'PARTIAL';
  if (findings.length) return 'IN_RESEARCH';
  return 'NOT_STARTED';
}

export function computePriority(indicator, value) {
  let score = 50;
  const hasN = Boolean(value?.numeratorRaw || value?.numeratorNumber !== null && value?.numeratorNumber !== undefined);
  const hasD = Boolean(value?.denominatorRaw || value?.denominatorNumber !== null && value?.denominatorNumber !== undefined);
  if (hasN !== hasD) score += 30;
  if (indicator.notes) score += 10;
  if ((indicator.notes || '').toLowerCase().includes('solicitar')) score -= 8;
  if (!hasN && !hasD) score -= 10;
  return Math.max(1, Math.min(100, score));
}

export function buildRequestText(indicator, targetField = 'NUMERATOR') {
  const isNumerator = targetField === 'NUMERATOR';
  const requested = isNumerator ? indicator.numeratorDescription : indicator.denominatorDescription;
  const field = isNumerator ? 'numerador' : 'denominador';
  return `Assunto: Solicitação de dados para o indicador ${indicator.code} da ABNT NBR ISO ${indicator.standard.code}\n\nPrezados(as),\n\nPara fins de cálculo, rastreabilidade e comprovação do indicador ${indicator.code} — ${indicator.name} — da ABNT NBR ISO ${indicator.standard.code}, solicitamos o fornecimento da informação necessária ao ${field}:\n\n${requested || 'Informação correspondente ao componente do indicador.'}\n\nSolicitamos, sempre que possível, que a resposta informe:\n- valor e unidade de medida;\n- ano/período de referência;\n- abrangência territorial (município de Viçosa/MG);\n- metodologia utilizada;\n- setor responsável pelo dado;\n- documento, relatório, planilha ou outro registro comprobatório.\n\nCaso o dado seja estimado, solicitamos também a memória de cálculo e as premissas adotadas.\n\nAtenciosamente,\nProjeto Viçosa SMART`;
}

export function cleanUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
