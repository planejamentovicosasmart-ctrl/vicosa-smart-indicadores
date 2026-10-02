import { useEffect, useState } from 'react';
import { Search, Link2, Layers3, Database, AlertCircle } from 'lucide-react';
import { api } from '../api.js';

const roleLabel = (roles=[]) => roles.length > 1 ? 'Numerador e denominador' : roles[0] === 'NUMERATOR' ? 'Numerador' : 'Denominador';

export function AuxiliaryView({ globalSearch, openIndicator }) {
  const [q,setQ]=useState(globalSearch||'');
  const [role,setRole]=useState('');
  const [standard,setStandard]=useState('');
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{ if(globalSearch) setQ(globalSearch); },[globalSearch]);
  useEffect(()=>{
    setError('');
    api.auxiliary({q,role,standard}).then(setData).catch(e=>{setData({items:[],total:0});setError(e.message);});
  },[q,role,standard]);

  return <div className="page-content">
    <section className="page-header"><div><span className="eyebrow">Componentes das normas</span><h1>Indicadores auxiliares</h1><p>Aqui ficam somente os numeradores e denominadores usados nos indicadores ABNT. Componentes iguais aparecem uma única vez, mesmo quando atendem vários indicadores.</p></div></section>
    {error&&<div className="inline-message error"><AlertCircle size={16}/>{error}</div>}
    <div className="filter-bar">
      <label className="search-field"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar numerador, denominador ou indicador relacionado..."/></label>
      <label className="select-field"><Layers3 size={16}/><select value={role} onChange={e=>setRole(e.target.value)}><option value="">Numeradores e denominadores</option><option value="NUMERATOR">Somente numeradores</option><option value="DENOMINATOR">Somente denominadores</option></select></label>
      <label className="select-field"><Database size={16}/><select value={standard} onChange={e=>setStandard(e.target.value)}><option value="">Todas as normas</option><option value="37120">ISO 37120</option><option value="37122">ISO 37122</option><option value="37123">ISO 37123</option></select></label>
    </div>
    <div className="results-line"><span><strong>{data?.total ?? '—'}</strong> componentes únicos</span><span>Sem duplicação por texto do componente.</span></div>
    <div className="aux-table component-table">
      <div className="aux-row aux-head"><span>Componente</span><span>Tipo</span><span>Dados disponíveis</span><span>Usado em</span></div>
      {data?.items?.map(i=><div className="aux-row" key={i.id}>
        <span><strong>{i.name}</strong><small>{i.values.length ? `${i.values.length} valor(es) cadastrado(s)` : 'Ainda sem valor cadastrado'}</small></span>
        <span><em>{roleLabel(i.roles)}</em></span>
        <span>{i.values.length ? i.values.slice(0,2).map((v,idx)=><div className="component-value" key={idx}><b>{v.raw ?? v.number}</b><small>{[v.year,v.source].filter(Boolean).join(' · ')}</small></div>) : <b>—</b>}</span>
        <span className="component-relations">{i.uses.slice(0,4).map(u=><button key={`${u.indicatorId}-${u.role}`} className="relation-chip" onClick={()=>openIndicator?.(u.indicatorId)}><Link2 size={13}/> ISO {u.standard} · {u.code}</button>)}{i.uses.length>4&&<small>+{i.uses.length-4} relação(ões)</small>}</span>
      </div>)}
    </div>
    {!data?.items?.length&&<div className="empty-state"><Database/><h3>Nenhum componente encontrado</h3><p>Ajuste os filtros. Numeradores e denominadores só aparecem quando já estão definidos para algum indicador da norma.</p></div>}
  </div>;
}
