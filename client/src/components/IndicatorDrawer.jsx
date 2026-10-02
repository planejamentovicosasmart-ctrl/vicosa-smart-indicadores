import { useEffect, useMemo, useState } from 'react';
import { X, Search, ExternalLink, FileText, ShieldCheck, CalendarDays, Calculator, Database, Copy, Check, AlertTriangle, Clock3, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from './StatusBadge.jsx';

const fmt = (v) => v == null || v === '' ? '—' : String(v);
const originLabel = (origin) => ({
  GETERR: 'Geterr',
  VICOSA_SMART: 'Viçosa SMART',
  AGENT: 'Agente de pesquisa',
  MANUAL: 'Inserção manual',
}[origin] || origin || 'Não informada');

export function IndicatorDrawer({ indicatorId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState('');

  const load = async () => {
    if (!indicatorId) return;
    setLoading(true); setMessage('');
    try { setData(await api.indicator(indicatorId)); }
    catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { setHint(''); load(); }, [indicatorId]);

  const v = data?.currentValue;
  const isValidated = data?.status === 'VALIDATED';
  const isGeterr = data?.status === 'COMPLETE' && v?.origin === 'GETERR';
  const isAuditCandidate = data?.status === 'AWAITING_VALIDATION' && v?.origin === 'VICOSA_SMART';
  const needsResearch = ['NOT_STARTED','PARTIAL','NEEDS_REQUEST','REVIEW_NEEDED','IN_RESEARCH'].includes(data?.status);
  const calc = useMemo(() => {
    if (!v) return null;
    if (v.finalFormula) return v.finalFormula;
    if (v.numeratorNumber != null && v.denominatorNumber != null && data?.unit === '%') return '(Numerador ÷ Denominador) × 100';
    if (v.numeratorNumber != null && v.denominatorNumber != null) return 'Numerador ÷ Denominador';
    return null;
  }, [data, v]);

  const research = async () => {
    setLoading(true);
    setMessage(isAuditCandidate ? 'Auditando o candidato em fontes públicas...' : 'Pesquisando fontes públicas...');
    try {
      const r = await api.researchIndicator(indicatorId, hint);
      setMessage(r.summary || 'Pesquisa concluída.');
      setHint('');
      await load(); onChanged?.();
    } catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  };

  const approve = async () => {
    setLoading(true); setMessage('');
    try {
      await api.approveCurrentValue(indicatorId);
      setMessage('Candidato aprovado pela equipe e marcado como validado.');
      await load(); onChanged?.();
    } catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  };

  const reject = async () => {
    const reason = prompt('Motivo para descartar este candidato:') || 'Candidato descartado durante auditoria';
    setLoading(true); setMessage('');
    try {
      await api.rejectCurrentValue(indicatorId, reason);
      setMessage('Candidato descartado. O indicador voltou para a fila de pesquisa.');
      await load(); onChanged?.();
    } catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  };

  const copyRequest = async (field) => {
    try {
      const r = await api.requestTemplate(indicatorId, field);
      await navigator.clipboard.writeText(r.text);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) { setMessage(e.message); }
  };

  if (!indicatorId) return null;
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="indicator-drawer">
        <div className="drawer-head">
          <div>
            <div className="eyebrow">{data ? `ISO ${data.standard.code} · Indicador ${data.code}` : 'Carregando indicador'}</div>
            <h2>{data?.name || '...'}</h2>
            {data && <StatusBadge status={data.status}/>}
          </div>
          <button className="icon-btn close" onClick={onClose}><X size={20}/></button>
        </div>

        {message && <div className={`inline-message ${/erro|não configurado|falha/i.test(message) ? 'error' : ''}`}>{message}</div>}
        {data && isGeterr && <div className="inline-message">Encontrado na base <strong>Geterr</strong>. Este registro pertence às normas e foi mantido como dado já localizado.</div>}
        {data && isAuditCandidate && <div className="inline-message">Candidato levantado pelo <strong>Viçosa SMART</strong>. Ele ainda não está aprovado para uso ABNT: você pode pedir ao agente para auditar as fontes e depois aprovar ou descartar.</div>}
        {data && data.status === 'PARTIAL' && <div className="inline-message">Levantamento parcial do Viçosa SMART. O agente pode procurar o componente que falta e comparar as fontes.</div>}
        {data && needsResearch && !v && <div className="inline-message">O Geterr não encontrou este indicador. Ele está na fila prioritária de pesquisa.</div>}
        {data && isValidated && <div className="inline-message">Dado auditado e aprovado pela equipe.</div>}

        {loading && !data ? <div className="drawer-loading">Carregando informações...</div> : data && <div className="drawer-content">
          <section className="detail-section formula-panel">
            <div className="section-title"><Calculator size={18}/><span>Estrutura do indicador</span></div>
            <div className="formula-flow">
              <div><small>Numerador</small><strong>{data.numeratorDescription || 'Ainda não cadastrado'}</strong></div>
              <span>÷</span>
              <div><small>Denominador</small><strong>{data.denominatorDescription || 'Ainda não cadastrado'}</strong></div>
              <span>=</span>
              <div className="result-box"><small>Resultado</small><strong>{fmt(v?.finalRaw ?? v?.finalNumber)} {data.unit || ''}</strong></div>
            </div>
            {calc && <div className="formula-note">Memória/fórmula: <code>{calc}</code></div>}
          </section>

          <section className="detail-section">
            <div className="section-title"><Database size={18}/><span>Origem do dado atual</span></div>
            <div className="quality-grid">
              <div><span>Origem</span><strong>{originLabel(v?.origin)}</strong></div>
              <div><span>Base</span><strong>{fmt(v?.sourceLabel)}</strong></div>
              <div><span>Ano do resultado</span><strong>{fmt(v?.finalYear)}</strong></div>
              <div><span>Fonte do resultado</span><strong>{fmt(v?.finalSource)}</strong></div>
            </div>
            {v?.finalSourceUrl && <a href={v.finalSourceUrl} target="_blank" rel="noreferrer" className="text-link">Abrir fonte do resultado <ExternalLink size={14}/></a>}
          </section>

          <div className="detail-grid two">
            <section className="detail-card">
              <div className="detail-card-title"><Database size={17}/> Numerador</div>
              <dl><dt>Valor</dt><dd>{fmt(v?.numeratorRaw ?? v?.numeratorNumber)}</dd><dt>Ano</dt><dd>{fmt(v?.numeratorYear)}</dd><dt>Fonte</dt><dd>{fmt(v?.numeratorSource)}</dd></dl>
              {v?.numeratorSourceUrl && <a href={v.numeratorSourceUrl} target="_blank" rel="noreferrer" className="text-link">Abrir fonte <ExternalLink size={14}/></a>}
              {!isValidated && !isGeterr && !v?.numeratorRaw && v?.numeratorNumber == null && <button className="secondary-btn compact" onClick={() => copyRequest('NUMERATOR')}><FileText size={15}/> Gerar solicitação</button>}
            </section>
            <section className="detail-card">
              <div className="detail-card-title"><Database size={17}/> Denominador</div>
              <dl><dt>Valor</dt><dd>{fmt(v?.denominatorRaw ?? v?.denominatorNumber)}</dd><dt>Ano</dt><dd>{fmt(v?.denominatorYear)}</dd><dt>Fonte</dt><dd>{fmt(v?.denominatorSource)}</dd></dl>
              {v?.denominatorSourceUrl && <a href={v.denominatorSourceUrl} target="_blank" rel="noreferrer" className="text-link">Abrir fonte <ExternalLink size={14}/></a>}
              {!isValidated && !isGeterr && !v?.denominatorRaw && v?.denominatorNumber == null && <button className="secondary-btn compact" onClick={() => copyRequest('DENOMINATOR')}><FileText size={15}/> Gerar solicitação</button>}
            </section>
          </div>

          <section className="detail-section">
            <div className="section-title"><ShieldCheck size={18}/><span>Qualidade do dado</span></div>
            <div className="quality-grid">
              <div><span>Anos compatíveis</span><strong className={data.quality.yearsCompatible === false ? 'danger-text' : ''}>{data.quality.yearsCompatible == null ? 'A verificar' : data.quality.yearsCompatible ? 'Sim' : 'Não'}</strong></div>
              <div><span>Fonte do numerador</span><strong>{data.quality.hasNumeratorSource ? 'Registrada' : 'Ausente'}</strong></div>
              <div><span>Fonte do denominador</span><strong>{data.quality.hasDenominatorSource ? 'Registrada' : 'Ausente'}</strong></div>
              <div><span>Auditoria</span><strong>{data.quality.validationState === 'VALIDATED' ? 'Aprovado pela equipe' : isGeterr ? 'Base Geterr' : 'Pendente'}</strong></div>
            </div>
            {data.quality.yearsCompatible === false && <div className="warning-box"><AlertTriangle size={17}/> Numerador e denominador usam anos diferentes. Revise antes de apresentar o indicador.</div>}
          </section>

          <section className="detail-section">
            <div className="section-title"><Sparkles size={18}/><span>Copiloto de pesquisa</span></div>
            <p className="notes-text">{isAuditCandidate ? 'Peça ao agente para conferir este candidato. Você também pode colar uma pista, URL, órgão ou observação para orientar a auditoria.' : 'Pesquise este indicador junto com o agente. Se você já souber uma fonte ou tiver uma pista, informe abaixo.'}</p>
            <label className="search-field" style={{maxWidth:'100%'}}><Search size={17}/><input value={hint} onChange={e=>setHint(e.target.value)} placeholder="Ex.: SINISA 2025, site do SAAE, URL de uma planilha, observação..."/></label>
            <div style={{marginTop:10,display:'flex',gap:8,flexWrap:'wrap'}}>
              <button className="primary-btn" disabled={loading} onClick={research}><Search size={17}/>{loading ? 'Pesquisando...' : isAuditCandidate ? 'Auditar com o agente' : isGeterr ? 'Pesquisar atualização' : 'Pesquisar com o agente'}</button>
              {isAuditCandidate && <button className="secondary-btn" disabled={loading} onClick={approve}><ShieldCheck size={16}/> Aprovar candidato</button>}
              {isAuditCandidate && <button className="ghost-btn" disabled={loading} onClick={reject}><Trash2 size={16}/> Descartar candidato</button>}
            </div>
          </section>

          <section className="detail-section">
            <div className="section-title"><Search size={18}/><span>Descobertas do agente</span><b>{data.findings.length}</b></div>
            {data.findings.length === 0 ? <div className="empty-mini">Nenhuma descoberta registrada para este indicador.</div> : data.findings.slice(0, 8).map((f) => (
              <div className="mini-finding" key={f.id}>
                <div><StatusBadge status={f.status}/><strong>{f.targetField === 'AUDIT' ? 'AUDITORIA' : f.targetField}</strong><span>{f.sourceName}</span></div>
                <div><b>{f.candidateValueRaw || 'Fonte/evidência candidata'}</b><small>{f.referenceYear || 'ano a confirmar'} · confiança {f.confidenceScore}%</small></div>
                {f.confidenceReason && <small>{f.confidenceReason}</small>}
              </div>
            ))}
          </section>

          <section className="detail-section">
            <div className="section-title"><FileText size={18}/><span>Evidências</span><b>{data.evidence.length}</b></div>
            {data.evidence.length === 0 ? <div className="empty-mini">Ainda não há evidências anexadas.</div> : data.evidence.slice(0, 8).map((e) => (
              <div className="evidence-row" key={e.id}>
                <FileText size={16}/><div><strong>{e.title || e.documentName || 'Evidência'}</strong><span>{e.organization || ''} {e.page ? `· pág. ${e.page}` : ''}</span></div>{e.url && <a href={e.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/></a>}
              </div>
            ))}
          </section>

          {data.notes && <section className="detail-section"><div className="section-title"><Clock3 size={18}/><span>Observações existentes</span></div><p className="notes-text">{data.notes}</p></section>}
          <section className="detail-section">
            <div className="section-title"><CalendarDays size={18}/><span>Histórico</span></div>
            <div className="timeline">{data.history.slice(0, 10).map((h) => <div key={h.id}><i/><span><strong>{h.action.replaceAll('_',' ')}</strong><small>{new Date(h.createdAt).toLocaleString('pt-BR')} · {h.actor}</small></span></div>)}</div>
          </section>
        </div>}

        <div className="drawer-actions">
          {!isValidated && !isGeterr && <button className="secondary-btn" onClick={() => copyRequest(!v?.numeratorRaw ? 'NUMERATOR' : 'DENOMINATOR')}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? 'Copiado' : 'Gerar solicitação'}</button>}
          {(isValidated || isGeterr) && <div className="secondary-btn" style={{pointerEvents:'none'}}><ShieldCheck size={17}/> {isGeterr ? 'Encontrado Geterr' : 'Dado validado'}</div>}
          <button className="primary-btn" disabled={loading} onClick={research}><Search size={17}/>{loading ? 'Pesquisando...' : isAuditCandidate ? 'Auditar com agente' : isGeterr ? 'Pesquisar atualização' : 'Pesquisar este indicador'}</button>
        </div>
      </aside>
    </div>
  );
}
