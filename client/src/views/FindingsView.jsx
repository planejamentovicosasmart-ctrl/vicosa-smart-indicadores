import { useEffect, useState } from 'react';
import { ExternalLink, Check, X, Clock3, ShieldCheck, Search, Inbox } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

export function FindingsView({ openIndicator, refreshKey, onChanged }) {
  const [data,setData]=useState(null);
  const [filter,setFilter]=useState('NEW,AWAITING_VALIDATION,DIVERGENCE');
  const [busy,setBusy]=useState('');
  const [msg,setMsg]=useState('');

  const load=()=>api.findings(filter).then(setData).catch(e=>{setData({items:[]});setMsg(e.message)});
  useEffect(load,[filter,refreshKey]);

  const act=async(item,type)=>{
    setBusy(item.id); setMsg('');
    try {
      if (item.kind === 'IMPORTED_VALUE' && type === 'validate') {
        await api.validateImportedValue(item.indicator.id);
      } else {
        if(type==='accept')await api.acceptFinding(item.id);
        if(type==='reject')await api.rejectFinding(item.id,prompt('Motivo da rejeição:')||'Rejeitado na revisão');
        if(type==='later')await api.laterFinding(item.id);
        if(type==='validate')await api.validateFinding(item.id);
      }
      await load(); onChanged?.();
    } catch(e) { setMsg(e.message); }
    finally { setBusy(''); }
  };

  const items = data?.items || [];

  return <div className="page-content">
    <section className="page-header findings-header"><div><span className="eyebrow">Caixa de entrada protegida</span><h1>Descobertas e dados para validar</h1><p>Aqui ficam tanto as descobertas do agente quanto os dados já fornecidos pela equipe/Geterr que ainda precisam de conferência.</p></div><div className="inbox-visual"><Inbox size={27}/><b>{items.length}</b><span>itens nesta visão</span></div></section>
    {msg&&<div className="inline-message error">{msg}</div>}
    <div className="filter-pills"><button className={filter==='NEW,AWAITING_VALIDATION,DIVERGENCE'?'active':''} onClick={()=>setFilter('NEW,AWAITING_VALIDATION,DIVERGENCE')}>Pendentes</button><button className={filter==='AWAITING_VALIDATION'?'active':''} onClick={()=>setFilter('AWAITING_VALIDATION')}>Aguardando validação</button><button className={filter==='VALIDATED'?'active':''} onClick={()=>setFilter('VALIDATED')}>Validadas</button><button className={filter==='REJECTED'?'active':''} onClick={()=>setFilter('REJECTED')}>Rejeitadas</button><button className={filter===''?'active':''} onClick={()=>setFilter('')}>Todas</button></div>
    <div className="findings-list">{items.map(f=>{
      const cur=f.indicator?.currentValue;
      const imported=f.kind==='IMPORTED_VALUE';
      const old=f.targetField==='NUMERATOR'?(cur?.numeratorRaw??cur?.numeratorNumber):f.targetField==='DENOMINATOR'?(cur?.denominatorRaw??cur?.denominatorNumber):(cur?.finalRaw??cur?.finalNumber);
      const candidate = imported ? (cur?.finalRaw ?? cur?.finalNumber ?? cur?.numeratorRaw ?? cur?.numeratorNumber ?? cur?.denominatorRaw ?? cur?.denominatorNumber) : (f.candidateValueRaw ?? f.candidateValueNumber);
      return <article className="finding-card" key={f.id}>
        <div className="finding-head"><div><span className="code-pill">{f.indicator?.code}</span><span>ISO {f.indicator?.standard?.code}</span><StatusBadge status={f.status}/>{imported&&<span className="imported-chip">Geterr/base fornecida</span>}</div><span className={`confidence confidence-${String(f.confidenceLevel||'MEDIUM').toLowerCase()}`}>{f.confidenceScore||60}% confiança</span></div>
        <h3 onClick={()=>openIndicator(f.indicator.id)}>{f.indicator.name}</h3>
        <div className="finding-compare"><div><small>{imported?'Dado importado':'Dado atual · '+f.targetField}</small><strong>{imported?(candidate??'Valor não localizado'):(old??'Não localizado')}</strong><span>{f.referenceYear||cur?.numeratorYear||cur?.denominatorYear||''}</span></div>{!imported&&<><i>→</i><div className="candidate"><small>Nova descoberta</small><strong>{candidate??'Fonte candidata'}</strong><span>{f.referenceYear||'ano a confirmar'} {f.unit?`· ${f.unit}`:''}</span></div></>}</div>
        <div className="finding-source"><div><span>Fonte</span><strong>{f.sourceName||'Base fornecida'}</strong><small>{f.sourceOrganization||f.sourceType||''}</small></div>{f.sourceUrl&&<a href={f.sourceUrl} target="_blank" rel="noreferrer">Ver fonte <ExternalLink size={14}/></a>}</div>
        {f.evidenceExcerpt&&<blockquote>{f.evidenceExcerpt}</blockquote>}
        <div className="confidence-reason"><ShieldCheck size={15}/>{f.confidenceReason||'Revisar a evidência antes de usar.'}</div>
        <div className="finding-actions">
          {!imported&&f.status==='NEW'&&<><button className="ghost-btn" disabled={busy===f.id} onClick={()=>act(f,'reject')}><X size={15}/> Rejeitar</button><button className="ghost-btn" disabled={busy===f.id} onClick={()=>act(f,'later')}><Clock3 size={15}/> Investigar depois</button><button className="secondary-btn" disabled={busy===f.id} onClick={()=>act(f,'accept')}><Check size={15}/> Aceitar descoberta</button></>}
          {f.status==='AWAITING_VALIDATION'&&<button className="primary-btn" disabled={busy===f.id} onClick={()=>act(f,'validate')}><ShieldCheck size={16}/> Validar dado</button>}
          <button className="text-button" onClick={()=>openIndicator(f.indicator.id)}><Search size={14}/> Abrir indicador</button>
        </div>
      </article>;
    })}</div>
    {!items.length&&<div className="empty-state"><Inbox/><h3>Nenhum item nesta fila</h3><p>Dados importados aguardando validação e novas descobertas do agente aparecerão aqui.</p></div>}
  </div>;
}
