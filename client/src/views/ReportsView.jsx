import { useEffect, useMemo, useState } from 'react';
import { Download, FileBarChart2, Printer, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

const statusLabels = {
  COMPLETE:'Completo', VALIDATED:'Validado', PARTIAL:'Parcial', NOT_STARTED:'Não encontrado',
  IN_RESEARCH:'Em pesquisa', AWAITING_VALIDATION:'Aguardando validação', NEEDS_REQUEST:'Necessita solicitação',
  REVIEW_NEEDED:'Revisão necessária', NOT_APPLICABLE:'Não aplicável',
};

function hasData(item){
  const v=item.currentValue || {};
  return Boolean(v.numeratorRaw || v.numeratorNumber != null || v.denominatorRaw || v.denominatorNumber != null || v.finalRaw || v.finalNumber != null);
}
function hasFinal(item){
  const v=item.currentValue || {};
  return Boolean(v.finalRaw || v.finalNumber != null);
}
function displayValue(raw, number){
  if(raw !== null && raw !== undefined && String(raw).trim()!=='') return String(raw);
  if(number !== null && number !== undefined) return String(number);
  return '';
}
function escapeCsv(value){
  const s=String(value ?? '').replace(/\r?\n/g,' ').trim();
  return `"${s.replace(/"/g,'""')}"`;
}
function downloadBlob(content,type,name){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}
function todayStamp(){ return new Date().toISOString().slice(0,10); }

export function ReportsView(){
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [standard,setStandard]=useState(''); const [scope,setScope]=useState('FOUND'); const [q,setQ]=useState('');
  const load=()=>{ setLoading(true); setError(''); api.indicators({limit:250}).then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false)); };
  useEffect(load,[]);

  const items=useMemo(()=>{
    const query=q.toLowerCase().trim();
    return (data?.items || []).filter(i=>{
      if(standard && i.standard?.code!==standard) return false;
      if(scope==='FOUND' && !hasData(i)) return false;
      if(scope==='FINAL' && !hasFinal(i)) return false;
      if(scope==='VALIDATED' && !['VALIDATED','COMPLETE'].includes(i.status)) return false;
      if(scope==='PARTIAL' && i.status!=='PARTIAL') return false;
      if(query && ![i.code,i.name,i.currentValue?.numeratorSource,i.currentValue?.denominatorSource].some(v=>String(v||'').toLowerCase().includes(query))) return false;
      return true;
    });
  },[data,standard,scope,q]);

  const summary=useMemo(()=>({
    total:items.length,
    final:items.filter(hasFinal).length,
    complete:items.filter(i=>['COMPLETE','VALIDATED'].includes(i.status)).length,
    partial:items.filter(i=>i.status==='PARTIAL').length,
  }),[items]);

  const csvRows=()=>{
    const headers=['Norma','Código','Indicador','Status','Numerador','Ano Numerador','Fonte Numerador','URL Numerador','Denominador','Ano Denominador','Fonte Denominador','URL Denominador','Valor Final','Unidade','Observações'];
    const rows=items.map(i=>{ const v=i.currentValue || {}; return [
      `ABNT NBR ISO ${i.standard?.code||''}`,i.code,i.name,statusLabels[i.status]||i.status,
      displayValue(v.numeratorRaw,v.numeratorNumber),v.numeratorYear||'',v.numeratorSource||'',v.numeratorSourceUrl||'',
      displayValue(v.denominatorRaw,v.denominatorNumber),v.denominatorYear||'',v.denominatorSource||'',v.denominatorSourceUrl||'',
      displayValue(v.finalRaw,v.finalNumber),i.unit||'',i.notes||''
    ];});
    return '\ufeff'+[headers,...rows].map(r=>r.map(escapeCsv).join(';')).join('\r\n');
  };

  const exportCsv=()=>downloadBlob(csvRows(),'text/csv;charset=utf-8',`Relatorio_Indicadores_Geterr_Vicosa_${todayStamp()}.csv`);

  const printReport=()=>{
    const rows=items.map(i=>{const v=i.currentValue||{}; return `<tr><td>${i.standard?.code||''}</td><td>${i.code||''}</td><td>${i.name||''}</td><td>${statusLabels[i.status]||i.status}</td><td>${displayValue(v.numeratorRaw,v.numeratorNumber)||'—'}</td><td>${v.numeratorYear||'—'}</td><td>${v.numeratorSource||'—'}</td><td>${displayValue(v.denominatorRaw,v.denominatorNumber)||'—'}</td><td>${v.denominatorYear||'—'}</td><td>${v.denominatorSource||'—'}</td><td>${displayValue(v.finalRaw,v.finalNumber)||'—'}</td><td>${i.unit||'—'}</td></tr>`}).join('');
    const w=window.open('','_blank'); if(!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório de Indicadores - Viçosa SMART</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:32px}h1{font-size:22px;margin:0 0 6px}p{font-size:11px;color:#667085;margin:4px 0}.meta{margin:18px 0;padding:12px;background:#f4f7f9;border-radius:8px;display:flex;gap:24px}.meta b{font-size:15px}.meta span{font-size:10px;color:#667085;display:block}table{width:100%;border-collapse:collapse;font-size:8px;margin-top:14px}th{background:#0b1723;color:#fff;text-align:left;padding:6px}td{border-bottom:1px solid #dfe5ea;padding:6px;vertical-align:top}footer{margin-top:18px;font-size:9px;color:#777}@page{size:landscape;margin:10mm}@media print{body{margin:0}}</style></head><body><h1>Relatório de Indicadores ABNT — Viçosa/MG</h1><p>Viçosa SMART • Relatório preparado para compartilhamento técnico com a Geterr.</p><p>Gerado em ${new Date().toLocaleString('pt-BR')}.</p><div class="meta"><div><b>${summary.total}</b><span>indicadores no relatório</span></div><div><b>${summary.complete}</b><span>completos/validados</span></div><div><b>${summary.partial}</b><span>parciais</span></div><div><b>${summary.final}</b><span>com resultado final</span></div></div><table><thead><tr><th>ISO</th><th>Código</th><th>Indicador</th><th>Status</th><th>Numerador</th><th>Ano N</th><th>Fonte N</th><th>Denominador</th><th>Ano D</th><th>Fonte D</th><th>Resultado</th><th>Unidade</th></tr></thead><tbody>${rows}</tbody></table><footer>Somente dados da base oficial são incluídos. Descobertas do agente ainda não validadas não entram neste relatório.</footer><script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  };

  return <div className="page-content">
    <section className="page-header reports-header"><div><span className="eyebrow">Compartilhamento técnico</span><h1>Relatórios</h1><p>Gere uma visão consolidada dos indicadores encontrados para encaminhar à Geterr ou acompanhar internamente.</p></div><div className="report-security"><ShieldCheck size={18}/><span><strong>Base oficial</strong><small>Descobertas pendentes não entram no relatório</small></span></div></section>

    <div className="report-toolbar">
      <div className="report-filter-group"><label>Norma<select value={standard} onChange={e=>setStandard(e.target.value)}><option value="">Todas as normas</option><option value="37120">ISO 37120</option><option value="37122">ISO 37122</option><option value="37123">ISO 37123</option></select></label><label>Conteúdo<select value={scope} onChange={e=>setScope(e.target.value)}><option value="FOUND">Com dados encontrados</option><option value="FINAL">Com resultado final</option><option value="VALIDATED">Completos / validados</option><option value="PARTIAL">Somente parciais</option><option value="ALL">Todos</option></select></label><label className="report-search">Pesquisar<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Indicador, código ou fonte..."/></label></div>
      <div className="report-actions"><button className="secondary-btn" onClick={load} disabled={loading}><RefreshCw size={15}/>Atualizar</button><button className="secondary-btn" onClick={printReport} disabled={!items.length}><Printer size={15}/>Imprimir / PDF</button><button className="primary-btn" onClick={exportCsv} disabled={!items.length}><Download size={15}/>Baixar CSV para Geterr</button></div>
    </div>

    {error && <div className="error-banner">{error}</div>}
    <div className="report-summary-grid"><div><span>Indicadores no relatório</span><strong>{loading?'—':summary.total}</strong></div><div><span>Completos / validados</span><strong>{loading?'—':summary.complete}</strong></div><div><span>Parciais</span><strong>{loading?'—':summary.partial}</strong></div><div><span>Com resultado final</span><strong>{loading?'—':summary.final}</strong></div></div>

    <section className="report-preview"><div className="report-preview-head"><div><FileBarChart2 size={18}/><span><strong>Prévia do relatório</strong><small>{standard?`ISO ${standard}`:'Todas as normas'} • {summary.total} registro(s)</small></span></div><small>CSV usa ponto e vírgula e abre normalmente no Excel.</small></div>
      <div className="report-table-wrap"><table className="report-table"><thead><tr><th>ISO</th><th>Código</th><th>Indicador</th><th>Status</th><th>Resultado</th><th>Ano</th><th>Fonte principal</th></tr></thead><tbody>{items.slice(0,100).map(i=>{const v=i.currentValue||{}; const year=v.numeratorYear||v.denominatorYear||''; const source=v.numeratorSource||v.denominatorSource||''; return <tr key={i.id}><td>{i.standard?.code}</td><td><b>{i.code}</b></td><td>{i.name}</td><td><StatusBadge status={i.status}/></td><td>{displayValue(v.finalRaw,v.finalNumber)||'—'} {i.unit||''}</td><td>{year||'—'}</td><td>{source||'—'}</td></tr>})}</tbody></table></div>
      {items.length>100 && <div className="report-more">Mostrando os primeiros 100 registros na prévia. O arquivo exportado contém todos os {items.length} registros.</div>}
      {!loading && !items.length && <div className="empty-state"><FileBarChart2/><h3>Nenhum indicador para este filtro</h3><p>Altere a norma ou o conteúdo do relatório.</p></div>}
    </section>
  </div>;
}
