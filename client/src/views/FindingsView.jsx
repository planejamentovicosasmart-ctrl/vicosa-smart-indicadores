import { useEffect, useState } from 'react';
import { ExternalLink, Check, X, Clock3, ShieldCheck, Search, Inbox, AlertTriangle } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

const safeText = (value, fallback='—') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return fallback; }
};

export function FindingsView({ openIndicator, refreshKey, onChanged }) {
  const [data,setData]=useState(null);
  const [filter,setFilter]=useState('NEW,IN_REVIEW,AWAITING_VALIDATION,DIVERGENCE');
  const [busy,setBusy]=useState('');
  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(true);

  const load=async()=>{
    setLoading(true);
    try {
      const result=await api.findings(filter);
      setData(result || {items:[]});
      setMsg('');
    } catch(e) {
      setData({items:[]});
      setMsg(e?.message || 'Não foi possível carregar as descobertas.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ load(); },[filter,refreshKey]);

  const act=async(item,type)=>{
    if(!item?.id) return;
    setBusy(item.id); setMsg('');
    try {
      if(type==='accept')await api.acceptFinding(item.id);
      if(type==='reject')await api.rejectFinding(item.id,prompt('Motivo da rejeição:')||'Rejeitado na revisão');
      if(type==='later')await api.laterFinding(item.id);
      if(type==='validate')await api.validateFinding(item.id);
      await load(); onChanged?.();
    } catch(e) { setMsg(e?.message || 'Não foi possível concluir a ação.'); }
    finally { setBusy(''); }
  };

  const rawItems = Array.isArray(data?.items) ? data.items : [];
  const orphanCount = rawItems.filter(f=>!f?.indicator?.id).length;
  const items = rawItems.filter(f=>f?.indicator?.id);

  return <div className="page-content">
    <section className="page-header findings-header">
      <div>
        <span className="eyebrow">Caixa de entrada do agente</span>
        <h1>Descobertas do agente</h1>
        <p>Aqui aparecem somente fontes, valores e evidências encontrados pelo agente. Os levantamentos do Viçosa SMART ficam na guia Validação ABNT.</p>
      </div>
      <div className="inbox-visual"><Inbox size={27}/><b>{items.length}</b><span>itens nesta visão</span></div>
    </section>

    {msg&&<div className="inline-message error">{msg}</div>}
    {orphanCount>0&&<div className="inline-message"><AlertTriangle size={16}/> {orphanCount} registro(s) antigo(s) sem indicador vinculado foram ignorados com segurança.</div>}

    <div className="filter-pills">
      <button className={filter==='NEW,IN_REVIEW,AWAITING_VALIDATION,DIVERGENCE'?'active':''} onClick={()=>setFilter('NEW,IN_REVIEW,AWAITING_VALIDATION,DIVERGENCE')}>Pendentes</button>
      <button className={filter==='IN_REVIEW'?'active':''} onClick={()=>setFilter('IN_REVIEW')}>Em revisão</button>
      <button className={filter==='AWAITING_VALIDATION'?'active':''} onClick={()=>setFilter('AWAITING_VALIDATION')}>Aguardando validação</button>
      <button className={filter==='VALIDATED'?'active':''} onClick={()=>setFilter('VALIDATED')}>Validadas</button>
      <button className={filter==='REJECTED'?'active':''} onClick={()=>setFilter('REJECTED')}>Rejeitadas</button>
      <button className={filter===''?'active':''} onClick={()=>setFilter('')}>Todas</button>
    </div>

    {loading&&<div className="empty-mini">Carregando descobertas...</div>}

    {!loading&&<div className="findings-list">{items.map(f=>{
      const indicator=f.indicator || {};
      const cur=indicator.currentValue || null;
      const target=String(f.targetField || 'SOURCE');
      const old=target==='NUMERATOR'
        ? (cur?.numeratorRaw??cur?.numeratorNumber)
        : target==='DENOMINATOR'
          ? (cur?.denominatorRaw??cur?.denominatorNumber)
          : (cur?.finalRaw??cur?.finalNumber);
      const candidate=f.candidateValueRaw ?? f.candidateValueNumber ?? null;
      const canValidate=['NUMERATOR','DENOMINATOR','FINAL','UPDATE'].includes(target);
      return <article className="finding-card" key={f.id}>
        <div className="finding-head">
          <div>
            <span className="code-pill">{safeText(indicator.code,'?')}</span>
            <span>ISO {safeText(indicator.standard?.code,'?')}</span>
            <StatusBadge status={f.status}/>
            {target==='SOURCE_AUDIT'&&<span className="imported-chip">AUDITORIA DE FONTE</span>}
          </div>
          <span className={`confidence confidence-${String(f.confidenceLevel||'MEDIUM').toLowerCase()}`}>{Number.isFinite(Number(f.confidenceScore))?Number(f.confidenceScore):0}% confiança</span>
        </div>

        <h3 onClick={()=>indicator.id&&openIndicator?.(indicator.id)}>{safeText(indicator.name,'Indicador sem nome')}</h3>

        <div className="finding-compare">
          <div>
            <small>Dado atual · {safeText(target)}</small>
            <strong>{safeText(old,'Não localizado')}</strong>
            <span>{safeText(f.referenceYear||cur?.finalYear||cur?.numeratorYear||cur?.denominatorYear,'')}</span>
          </div>
          <i>→</i>
          <div className="candidate">
            <small>{target==='SOURCE_AUDIT'?'Resultado da auditoria':'Nova descoberta'}</small>
            <strong>{safeText(candidate,target==='SOURCE_AUDIT'?'Análise de fonte':'Fonte candidata')}</strong>
            <span>{safeText(f.referenceYear,'ano a confirmar')} {f.unit?`· ${safeText(f.unit,'')}`:''}</span>
          </div>
        </div>

        <div className="finding-source">
          <div>
            <span>Fonte encontrada</span>
            <strong>{safeText(f.sourceName,'Fonte ainda não identificada')}</strong>
            <small>{safeText(f.sourceOrganization||f.sourceType,'')}</small>
          </div>
          {typeof f.sourceUrl==='string'&&f.sourceUrl&&<a href={f.sourceUrl} target="_blank" rel="noreferrer">Ver fonte <ExternalLink size={14}/></a>}
        </div>

        {typeof f.evidenceExcerpt==='string'&&f.evidenceExcerpt&&<blockquote>{f.evidenceExcerpt}</blockquote>}
        <div className="confidence-reason"><ShieldCheck size={15}/>{safeText(f.confidenceReason,'Revisar a evidência antes de usar.')}</div>

        <div className="finding-actions">
          {f.status==='NEW'&&<><button className="ghost-btn" disabled={busy===f.id} onClick={()=>act(f,'reject')}><X size={15}/> Rejeitar</button><button className="ghost-btn" disabled={busy===f.id} onClick={()=>act(f,'later')}><Clock3 size={15}/> Investigar depois</button><button className="secondary-btn" disabled={busy===f.id} onClick={()=>act(f,'accept')}><Check size={15}/> Aceitar descoberta</button></>}
          {f.status==='AWAITING_VALIDATION'&&canValidate&&<button className="primary-btn" disabled={busy===f.id} onClick={()=>act(f,'validate')}><ShieldCheck size={16}/> Validar dado</button>}
          {indicator.id&&<button className="text-button" onClick={()=>openIndicator?.(indicator.id)}><Search size={14}/> Abrir indicador</button>}
        </div>
      </article>;
    })}</div>}

    {!loading&&!items.length&&<div className="empty-state"><Inbox/><h3>Nenhuma descoberta nesta fila</h3><p>Quando o agente encontrar uma nova fonte, valor ou evidência, ela aparecerá aqui para sua revisão.</p></div>}
  </div>;
}
