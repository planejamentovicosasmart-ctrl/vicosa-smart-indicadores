const labels = {
  NOT_STARTED: 'Não encontrado',
  IN_RESEARCH: 'Em pesquisa',
  PARTIAL: 'Parcial',
  COMPLETE: 'Completo',
  AWAITING_VALIDATION: 'Aguardando validação',
  VALIDATED: 'Validado',
  NEEDS_REQUEST: 'Necessita solicitação',
  NOT_APPLICABLE: 'Não aplicável',
  REVIEW_NEEDED: 'Revisão necessária',
  NEW: 'Nova',
  ACCEPTED: 'Aceita',
  REJECTED: 'Rejeitada',
  INVESTIGATE_LATER: 'Investigar depois',
  DIVERGENCE: 'Divergência',
};

export function StatusBadge({ status }) {
  return <span className={`status-badge status-${String(status || '').toLowerCase()}`}>{labels[status] || status || '—'}</span>;
}
