import { useEffect, useState } from 'react';
import { Search, Link2, Layers3 } from 'lucide-react';
import { api } from '../api.js';
export function AuxiliaryView({ globalSearch }) {
  const [q,setQ]=useState(globalSearch||''); const [category,setCategory]=useState(''); const [data,setData]=useState(null);
  useEffect(()=>{ if(globalSearch) setQ(globalSearch); },[globalSearch]);
  useEffect(()=>{ api.auxiliary({q,category}).then(setData); },[q,category]);
  return <div className="page-content"><section className="page-header"><div><span className="eyebrow">Camada de apoio</span><h1>Indicadores auxiliares</h1><p>Dados complementares ficam separados da base oficial e ajudam a localizar fontes, relações e contexto.</p></div></section>
    <div className="filter-bar"><label className="search-field"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar indicador auxiliar..."/></label><label className="select-field"><Layers3 size={16}/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Todas as categorias</option>{data?.categories.map(c=><option key={c.name}>{c.name}</option>)}</select></label></div>
    <div className="category-chips"><button className={!category?'active':''} onClick={()=>setCategory('')}>Todos <b>{data?.total||0}</b></button>{data?.categories.slice(0,10).map(c=><button className={category===c.name?'active':''} onClick={()=>setCategory(c.name)} key={c.name}>{c.name}<b>{c.count}</b></button>)}</div>
    <div className="aux-table"><div className="aux-row aux-head"><span>Indicador</span><span>Categoria</span><span>Valor disponível</span><span>Relação ABNT</span></div>{data?.items.map(i=><div className="aux-row" key={i.id}><span><strong>{i.code?`${i.code} · `:''}{i.name}</strong><small>{i.referenceDate?`Referência: ${i.referenceDate}`:'Sem data cadastrada'}</small></span><span><em>{i.category||'Outros'}</em></span><span><b className={i.valueRaw?'value-ok':''}>{i.valueRaw|| (i.available===true?'Sim':i.available===false?'Não':'—')}</b></span><span>{i.relatedIndicator?<span className="relation-chip"><Link2 size={13}/> ISO {i.relatedIndicator.standard.code} · {i.relatedIndicator.code}</span>:'—'}</span></div>)}</div>
  </div>;
}
