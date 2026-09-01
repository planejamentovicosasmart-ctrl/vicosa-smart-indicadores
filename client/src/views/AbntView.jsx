import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, LayoutGrid, List, ArrowRight, Database } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

const norms = [['37120','Cidades Sustentáveis'],['37122','Cidades Inteligentes'],['37123','Cidades Resilientes']];
export function AbntView({ openIndicator, initialStandard, globalSearch, refreshKey }) {
  const [standard,setStandard]=useState(initialStandard || '37120');
  const [q,setQ]=useState(globalSearch || '');
  const [status,setStatus]=useState('');
  const [mode,setMode]=useState('list');
  const [data,setData]=useState(null);
  useEffect(()=>{ if(initialStandard) setStandard(initialStandard); },[initialStandard]);
  useEffect(()=>{ if(globalSearch) setQ(globalSearch); },[globalSearch]);
  useEffect(()=>{ api.indicators({standard,q,status,limit:250}).then(setData); },[standard,q,status,refreshKey]);
  return <div className="page-content">
    <section className="page-header"><div><span className="eyebrow">Base oficial de trabalho</span><h1>Indicadores ABNT</h1><p>Explore as normas, identifique lacunas e abra cada indicador para conferir cálculo, fonte e evidências.</p></div></section>
    <div className="norm-tabs">{norms.map(([code,label])=><button className={standard===code?'active':''} onClick={()=>setStandard(code)} key={code}><span>ISO {code}</span><small>{label}</small></button>)}</div>
    <div className="filter-bar"><label className="search-field"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar nesta norma..."/></label><label className="select-field"><SlidersHorizontal size={16}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos os status</option><option value="COMPLETE">Completos</option><option value="PARTIAL">Parciais</option><option value="NOT_STARTED">Não encontrados</option><option value="AWAITING_VALIDATION">Aguardando validação</option><option value="VALIDATED">Validados</option><option value="REVIEW_NEEDED">Revisão necessária</option></select></label><div className="view-toggle"><button className={mode==='grid'?'active':''} onClick={()=>setMode('grid')}><LayoutGrid size={17}/></button><button className={mode==='list'?'active':''} onClick={()=>setMode('list')}><List size={17}/></button></div></div>
    <div className="results-line"><span><strong>{data?.total ?? '—'}</strong> indicadores encontrados</span><span>ISO {standard}</span></div>
    {mode==='grid' ? <div className="indicator-grid">{data?.items.map(i=><article className="indicator-card" key={i.id} onClick={()=>openIndicator(i.id)}><div className="indicator-card-top"><span className="code-pill">{i.code}</span><StatusBadge status={i.status}/></div><h3>{i.name}</h3><div className="mini-data"><div><small>Numerador</small><strong>{i.presence.numerator?'Disponível':'Pendente'}</strong></div><div><small>Denominador</small><strong>{i.presence.denominator?'Disponível':'Pendente'}</strong></div></div><div className="indicator-card-foot"><span>{i.findingCount>0?`${i.findingCount} descoberta(s) nova(s)`:'Sem novas descobertas'}</span><ArrowRight size={17}/></div></article>)}</div> : <div className="indicator-table"><div className="indicator-row table-head"><span>Código</span><span>Indicador</span><span>Dados</span><span>Status</span><span></span></div>{data?.items.map(i=><button className="indicator-row" key={i.id} onClick={()=>openIndicator(i.id)}><span className="code-cell">{i.code}</span><span className="name-cell"><strong>{i.name}</strong><small>ISO {i.standard.code}{i.findingCount?` · ${i.findingCount} descoberta(s)`:''}</small></span><span className="data-cell"><i className={i.presence.numerator?'ok':''}/><i className={i.presence.denominator?'ok':''}/><small>{i.presence.numerator && i.presence.denominator?'N + D':'ver detalhes'}</small></span><span><StatusBadge status={i.status}/></span><span><ArrowRight size={16}/></span></button>)}</div>}
    {!data?.items?.length && <div className="empty-state"><Database/><h3>Nenhum indicador encontrado</h3><p>Ajuste os filtros ou use outro termo de pesquisa.</p></div>}
  </div>;
}
