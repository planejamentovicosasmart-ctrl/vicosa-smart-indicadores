import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Search, AlertTriangle, XCircle, HelpCircle, ExternalLink, RefreshCw, Bot, CheckCircle2, CircleDashed, ArrowRight, Database } from 'lucide-react';
import { api } from '../api.js';

const verdictLabel={
  ADEQUATE:'Adequada',
  PARTIAL:'Adequada com ressalvas',
  INADEQUATE:'Inadequada',
  INCONCLUSIVE:'Inconclusiva',
};
const verdictClass=(v)=>`audit-verdict audit-${String(v||'PENDING').toLowerCase()}`;
const originLabel=(v)=>{
  const o=String(v?.origin||'').toUpperCase();
  if(o==='GETERR')return 'Geterr';
  if(o==='VICOSA_SMART')return 'Viçosa SMART';
  if(o==='AGENT')return 'Agente';
  if(o==='MANUAL')return 'Manual';
  return v?.sourceLabel||'Não informado';
};
const display=(raw,num)=>raw!==null&&raw!==undefined&&String(raw).trim()!==''?String(raw):(num!==null&&num!==undefined?String(num):'—');

export function ValidationView({ openIndicator, refreshKey, onChanged }){
  const [data,setData]=useState(null);
  const [q,setQ]=useState('');
  const [standard,setStandard]=useState('');
  const [origin,setOrigin]=useState('');
  const [verdict,setVerdict]=useState('');
  const [selectedId,setSelectedId]=useState(null);
  const [busy,setBusy]=useState('');
  const [batch,setBatch]=useState(false);
  const [hint,setHint]=useState('');
  const [msg,setMsg]=useState('');

  const load=async()=>{
    try{
      const d=await api.validation({q,standard,origin,verdict});
      setData(d);
      if(!selectedId && d.items?.[0]) setSelectedId(d.items[0].id);
      if(selectedId && !d.items?.some(x=>x.id===selectedId) && d.items?.[0]) setSelectedId(d.items[0].id);
    }catch(e){setMsg(e.message);}
  };
  useEffect(()=>{load();},[q,standard,origin,verdict,refreshKey]);

  const items=data?.items||[];
  const selected=useMemo(()=>items.find(i=>i.id===selectedId)||items[0]||null,[items,selectedId]);
  const current=selected?.currentValue||{};
  const audit=selected?.audit||null;

  const runOne=async()=>{
    if(!selected)return;
    setBusy(selected.id);setMsg('');
    try{
      const r=await api.validateIndicatorSource(selected.id,hint);
      setMsg(`Auditoria concluída: ${verdictLabel[r.rawPayload?.verdict]||r.rawPayload?.verdict||'resultado registrado'}.`);
      setHint('');
      await load(); onChanged?.();
    }catch(e){setMsg(e.message);}
    finally{setBusy('');}
  };
  const runBatch=async()=>{
    setBatch(true);setMsg('');
    try{
      const r=await api.runValidation(standard,5);
      const ok=(r.results||[]).filter(x=>x.ok).length;
      setMsg(`${ok} auditoria(s) concluída(s) nesta rodada.`);
      await load(); onChanged?.();
    }catch(e){setMsg(e.message);}
    finally{setBatch(false);}
  };

  const criteriaEntries=audit?[
    ['Fonte oficial',audit.criteria?.sourceOfficial],
    ['Fonte primária',audit.criteria?.sourcePrimary],
    ['É de Viçosa/MG',audit.criteria?.municipalityMatch],
    ['Ano compatível',audit.criteria?.yearMatch],
    ['Conceito compatível',audit.criteria?.conceptMatch],
    ['Numerador compatível',audit.criteria?.numeratorMatch],
    ['Denominador compatível',audit.criteria?.denominatorMatch],
    ['Unidade compatível',audit.criteria?.unitMatch],
    ['Cálculo compatível',audit.criteria?.calculationMatch],
    ['Evidência rastreável',audit.criteria?.traceableEvidence],
  ]:[];

  return <div className="page-content">
    <section className="page-header validation-header">
      <div><span className="eyebrow">Auditoria técnica para ABNT</span><h1>Validação de fontes</h1><p>O agente confere se a fonte realmente sustenta o indicador cadastrado: município, ano, conceito, numerador, denominador, unidade, cálculo e rastreabilidade. A decisão final continua sendo humana.</p></div>
      <button className="primary-btn" disabled={batch||!data?.configured} onClick={runBatch}>{batch?<RefreshCw className="spin" size={17}/>:<Bot size={17}/>} {batch?'Auditando...':'Auditar próxima rodada'}</button>
    </section>

    {msg&&<div className={`inline-message ${/erro|não configurado|falha/i.test(msg)?'error':''}`}>{msg}</div>}
    {!data?.configured&&<div className="configuration-callout"><AlertTriangle size={20}/><div><strong>Agente de validação ainda sem chave</strong><p>Configure <code>OPENAI_API_KEY</code> no Render para validar fonte e aderência ao indicador usando pesquisa web.</p></div></div>}

    <section className="audit-metrics">
      <article><Search/><span><strong>{data?.summary?.pending??'—'}</strong><small>sem auditoria</small></span></article>
      <article><ShieldCheck/><span><strong>{data?.summary?.audited??'—'}</strong><small>auditados</small></span></article>
      <article><CheckCircle2/><span><strong>{data?.summary?.adequate??'—'}</strong><small>adequados</small></span></article>
      <article><CircleDashed/><span><strong>{data?.summary?.partial??'—'}</strong><small>com ressalvas</small></span></article>
      <article><XCircle/><span><strong>{data?.summary?.inadequate??'—'}</strong><small>inadequados</small></span></article>
      <article><HelpCircle/><span><strong>{data?.summary?.inconclusive??'—'}</strong><small>inconclusivos</small></span></article>
    </section>

    <div className="filter-bar">
      <label className="search-field"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar código ou indicador..."/></label>
      <label className="select-field"><Database size={16}/><select value={standard} onChange={e=>setStandard(e.target.value)}><option value="">Todas as normas</option><option value="37120">ISO 37120</option><option value="37122">ISO 37122</option><option value="37123">ISO 37123</option></select></label>
      <label className="select-field"><select value={origin} onChange={e=>setOrigin(e.target.value)}><option value="">Todas as origens</option><option value="GETERR">Geterr</option><option value="VICOSA_SMART">Viçosa SMART</option><option value="AGENT">Agente</option><option value="MANUAL">Manual</option></select></label>
      <label className="select-field"><select value={verdict} onChange={e=>setVerdict(e.target.value)}><option value="">Todas as auditorias</option><option value="PENDING">Sem auditoria</option><option value="ADEQUATE">Adequada</option><option value="PARTIAL">Com ressalvas</option><option value="INADEQUATE">Inadequada</option><option value="INCONCLUSIVE">Inconclusiva</option></select></label>
    </div>

    <div className="validation-workbench">
      <section className="validation-list">
        <div className="validation-row validation-head"><span>Código</span><span>Indicador</span><span>Encontrado em</span><span>Fonte atual</span><span>Auditoria</span><span></span></div>
        {items.map(i=><button key={i.id} className={`validation-row ${selected?.id===i.id?'selected':''}`} onClick={()=>setSelectedId(i.id)}>
          <span className="code-cell">{i.code}</span>
          <span className="name-cell"><strong>{i.name}</strong><small>ISO {i.standard.code}</small></span>
          <span className="found-origin"><b>{i.foundAt}</b><small>{i.currentValue?.sourceLabel||''}</small></span>
          <span className="source-cell">{i.sourceName||'Sem fonte oficial comprovada'}</span>
          <span>{i.audit?<span className={verdictClass(i.audit.verdict)}>{verdictLabel[i.audit.verdict]||i.audit.verdict} · {i.audit.score}%</span>:<span className="audit-verdict audit-pending">Pendente</span>}</span>
          <span><ArrowRight size={16}/></span>
        </button>)}
        {!items.length&&<div className="empty-state"><ShieldCheck/><h3>Nenhum indicador neste filtro</h3><p>Ajuste os filtros para continuar a auditoria.</p></div>}
      </section>

      <aside className="validation-detail">
        {!selected?<div className="empty-state"><ShieldCheck/><h3>Selecione um indicador</h3></div>:<>
          <div className="validation-detail-head"><div><span className="eyebrow">ISO {selected.standard.code} · {selected.code}</span><h3>{selected.name}</h3></div><button className="text-button" onClick={()=>openIndicator(selected.id)}>Abrir indicador <ArrowRight size={14}/></button></div>
          <div className="audit-current">
            <div><span>Encontrado em</span><strong>{originLabel(current)}</strong></div>
            <div><span>Fonte/evidência atual</span><strong>{selected.sourceName||'Ainda não comprovada'}</strong>{selected.sourceUrl&&<a href={selected.sourceUrl} target="_blank" rel="noreferrer">Abrir <ExternalLink size={13}/></a>}</div>
            <div><span>Resultado</span><strong>{display(current.finalRaw,current.finalNumber)}</strong></div>
            <div><span>Ano</span><strong>{current.finalYear||current.numeratorYear||current.denominatorYear||'—'}</strong></div>
          </div>

          {audit?<section className="audit-result">
            <div className="audit-result-top"><div><span>Última auditoria</span><strong className={verdictClass(audit.verdict)}>{verdictLabel[audit.verdict]||audit.verdict}</strong></div><div className="audit-score"><b>{audit.score}%</b><small>confiança técnica</small></div></div>
            <p>{audit.summary||'Sem resumo registrado.'}</p>
            <div className="audit-criteria">{criteriaEntries.map(([label,val])=><div key={label}><span>{label}</span><strong className={val===true?'criterion-ok':val===false?'criterion-bad':''}>{val===true?'Sim':val===false?'Não':'Não verificado'}</strong></div>)}</div>
            {audit.issues?.length>0&&<div className="audit-issues"><strong>Pontos de atenção</strong>{audit.issues.map((x,idx)=><span key={idx}><AlertTriangle size={13}/>{x}</span>)}</div>}
            {audit.recommendation&&<div className="audit-recommendation"><strong>Próximo passo</strong><p>{audit.recommendation}</p></div>}
            {audit.recalculatedValue&&<div className="audit-recalc"><span>Valor recalculado pelo agente</span><strong>{audit.recalculatedValue}</strong></div>}
            {audit.sourceUrl&&<a className="text-link" href={audit.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte auditada <ExternalLink size={14}/></a>}
          </section>:<div className="audit-empty"><ShieldCheck size={25}/><strong>Ainda não auditado</strong><p>O agente ainda não verificou se existe uma fonte oficial que realmente sustente este dado e este indicador.</p></div>}

          <section className="audit-agent-box">
            <div><Bot size={18}/><span><strong>Agente validador</strong><small>Ele procura fonte oficial e verifica se ela realmente serve para o indicador.</small></span></div>
            <label className="search-field"><Search size={16}/><input value={hint} onChange={e=>setHint(e.target.value)} placeholder="Ex.: conferir SINISA 2025, verificar página da GASMIG..."/></label>
            <button className="primary-btn wide" disabled={busy===selected.id||!data?.configured} onClick={runOne}>{busy===selected.id?<RefreshCw className="spin" size={16}/>:<ShieldCheck size={16}/>} {busy===selected.id?'Validando...':'Validar fonte e aderência ABNT'}</button>
            <small className="audit-disclaimer">O agente produz uma auditoria técnica e rastreável; ele não certifica conformidade ABNT automaticamente.</small>
          </section>
        </>}
      </aside>
    </div>
  </div>;
}
