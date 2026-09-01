import { useEffect, useMemo, useState } from 'react';
import { X, Search, ExternalLink, FileText, ShieldCheck, CalendarDays, Calculator, Database, Copy, Check, AlertTriangle, Clock3 } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from './StatusBadge.jsx';

const fmt = (v) => v == null || v === '' ? '—' : String(v);

export function IndicatorDrawer({ indicatorId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!indicatorId) return;
    setLoading(true); setMessage('');
    try { setData(await api.indicator(indicatorId)); }
    catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [indicatorId]);

  const v = data?.currentValue;
  const calc = useMemo(() => {
    if (!v) return null;
    if (v.finalFormula) return v.finalFormula;
    if (v.numeratorNumber != null && v.denominatorNumber != null && data?.unit === '%') return '(Numerador ÷ Denominador) × 100';
    if (v.numeratorNumber != null && v.denominatorNumber != null) return 'Numerador ÷ Denominador';
    return null;
  }, [data, v]);

  const research = async () => {
    setLoading(true); setMessage('Pesquisando fontes públicas...');
    try {
      const r = await api.researchIndicator(indicatorId);
      setMessage(r.summary || 'Pesquisa concluída.');
      await load(); onChanged?.();
    } catch (e) { setMessage(e.message); setLoading(false); }
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
        {message && <div className={`inline-message ${/erro|não configurado/i.test(message) ? 'error' : ''}`}>{message}</div>}
        {loading && !data ? <div className="drawer-loading">Carregando informações...</div> : data && <div className="drawer-content">
          <section className="detail-section formula-panel">
            <div className="section-title"><Calculator size={18}/><span>Estrutura do indicador</span></div>
            <div className="formula-flow">
              <div><small>Numerador</small><strong>{data.numeratorDescription || 'Não informado'}</strong></div>
              <span>÷</span>
              <div><small>Denominador</small><strong>{data.denominatorDescription || 'Não informado'}</strong></div>
              <span>=</span>
              <div className="result-box"><small>Resultado</small><strong>{fmt(v?.finalRaw ?? v?.finalNumber)} {data.unit || ''}</strong></div>
            </div>
            {calc && <div className="formula-note">Memória/fórmula: <code>{calc}</code></div>}
          </section>

          <div className="detail-grid two">
            <section className="detail-card">
              <div className="detail-card-title"><Database size={17}/> Numerador</div>
              <dl><dt>Valor</dt><dd>{fmt(v?.numeratorRaw ?? v?.numeratorNumber)}</dd><dt>Ano</dt><dd>{fmt(v?.numeratorYear)}</dd><dt>Fonte</dt><dd>{fmt(v?.numeratorSource)}</dd></dl>
              {v?.numeratorSourceUrl && <a href={v.numeratorSourceUrl} target="_blank" rel="noreferrer" className="text-link">Abrir fonte <ExternalLink size={14}/></a>}
              {!v?.numeratorRaw && v?.numeratorNumber == null && <button className="secondary-btn compact" onClick={() => copyRequest('NUMERATOR')}><FileText size={15}/> Gerar solicitação</button>}
            </section>
            <section className="detail-card">
              <div className="detail-card-title"><Database size={17}/> Denominador</div>
              <dl><dt>Valor</dt><dd>{fmt(v?.denominatorRaw ?? v?.denominatorNumber)}</dd><dt>Ano</dt><dd>{fmt(v?.denominatorYear)}</dd><dt>Fonte</dt><dd>{fmt(v?.denominatorSource)}</dd></dl>
              {v?.denominatorSourceUrl && <a href={v.denominatorSourceUrl} target="_blank" rel="noreferrer" className="text-link">Abrir fonte <ExternalLink size={14}/></a>}
              {!v?.denominatorRaw && v?.denominatorNumber == null && <button className="secondary-btn compact" onClick={() => copyRequest('DENOMINATOR')}><FileText size={15}/> Gerar solicitação</button>}
            </section>
          </div>

          <section className="detail-section">
            <div className="section-title"><ShieldCheck size={18}/><span>Qualidade do dado</span></div>
            <div className="quality-grid">
              <div><span>Anos compatíveis</span><strong className={data.quality.yearsCompatible === false ? 'danger-text' : ''}>{data.quality.yearsCompatible == null ? 'A verificar' : data.quality.yearsCompatible ? 'Sim' : 'Não'}</strong></div>
              <div><span>Fonte do numerador</span><strong>{data.quality.hasNumeratorSource ? 'Registrada' : 'Ausente'}</strong></div>
              <div><span>Fonte do denominador</span><strong>{data.quality.hasDenominatorSource ? 'Registrada' : 'Ausente'}</strong></div>
              <div><span>Validação</span><strong>{data.quality.validationState === 'VALIDATED' ? 'Validado' : 'Ainda não validado'}</strong></div>
            </div>
            {data.quality.yearsCompatible === false && <div className="warning-box"><AlertTriangle size={17}/> Numerador e denominador usam anos diferentes. Revise antes de apresentar o indicador.</div>}
          </section>

          <section className="detail-section">
            <div className="section-title"><Search size={18}/><span>Descobertas do agente</span><b>{data.findings.length}</b></div>
            {data.findings.length === 0 ? <div className="empty-mini">Nenhuma descoberta registrada para este indicador.</div> : data.findings.slice(0, 8).map((f) => (
              <div className="mini-finding" key={f.id}>
                <div><StatusBadge status={f.status}/><strong>{f.targetField}</strong><span>{f.sourceName}</span></div>
                <div><b>{f.candidateValueRaw || 'Fonte candidata'}</b><small>{f.referenceYear || 'ano a confirmar'} · confiança {f.confidenceScore}%</small></div>
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
          <button className="secondary-btn" onClick={() => copyRequest(!v?.numeratorRaw ? 'NUMERATOR' : 'DENOMINATOR')}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? 'Copiado' : 'Gerar solicitação'}</button>
          <button className="primary-btn" disabled={loading} onClick={research}><Search size={17}/>{loading ? 'Pesquisando...' : 'Pesquisar este indicador'}</button>
        </div>
      </aside>
    </div>
  );
}
