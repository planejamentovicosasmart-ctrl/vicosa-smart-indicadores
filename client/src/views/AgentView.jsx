import { useEffect, useState } from 'react';
import { Bot, Search, Database, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

export function AgentView({ openIndicator, go, refreshKey, onChanged }) {
  const [data,setData]=useState(null);
  const [running,setRunning]=useState(false);
  const [msg,setMsg]=useState('');

  const load=()=>api.agentStatus().then(setData).catch(e=>{setData({configured:false,provider:'Erro ao consultar servidor',queue:[],runs:[],newFindings:0});setMsg(e.message)});
  useEffect(load,[refreshKey]);

  const run=async(mode)=>{
    setRunning(mode);setMsg('');
    try {
      const r=await api.runAgent(mode);
      setMsg(r.summary||'Pesquisa concluída.');
      await load(); onChanged?.();
    } catch(e) { setMsg(e.message); }
    finally { setRunning(false); }
  };

  const queue=data?.queue||[];
  const runs=data?.runs||[];

  return <div className="page-content">
    <section className="agent-hero"><div className="agent-hero-icon"><Bot size={29}/><span/></div><div><span className="eyebrow">Pesquisa e auditoria assistidas por IA</span><h1>Agente de Indicadores</h1><p>Trabalha junto com você em dois fluxos: procura indicadores que o Geterr não encontrou e audita os candidatos levantados pelo Viçosa SMART. Nada é homologado automaticamente.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="primary-btn agent-run" disabled={running||!data?.configured} onClick={()=>run('search')}>{running==='search'?<RefreshCw className="spin" size={18}/>:<Search size={17}/>} {running==='search'?'Pesquisando...':'Pesquisar lacunas'}</button><button className="secondary-btn agent-run" disabled={running||!data?.configured} onClick={()=>run('audit')}>{running==='audit'?<RefreshCw className="spin" size={18}/>:<ShieldCheck size={17}/>} {running==='audit'?'Auditando...':'Auditar candidatos'}</button></div></section>
    {msg&&<div className={`inline-message ${/não configurado|erro|falha/i.test(msg)?'error':''}`}>{msg}</div>}
    <div className="agent-status-strip"><div><span className={`dot ${data?.configured?'online':''}`}/><p><strong>{data?.configured?'Agente configurado':'Agente sem chave de pesquisa'}</strong><small>{data?.provider||'Carregando...'}</small></p></div><div><Search/><p><strong>{data?.missingCount||0}</strong><small>sem dados · pesquisar</small></p></div><div><Database/><p><strong>{data?.partialCount||0}</strong><small>parciais · completar</small></p></div><div><ShieldCheck/><p><strong>{data?.auditCount||0}</strong><small>candidatos · auditar</small></p></div><div><CheckCircle2/><p><strong>{data?.newFindings||0}</strong><small>descobertas novas</small></p></div></div>
    {!data?.configured&&<div className="configuration-callout"><AlertCircle size={20}/><div><strong>Pesquisa automática ainda desativada</strong><p>O restante do sistema já funciona. Para a pesquisa automática, configure <code>GEMINI_API_KEY</code> no Render. OpenAI/Tavily permanecem apenas como fallback opcional.</p></div></div>}
    <div className="agent-workbench"><section className="queue-panel"><div className="workbench-title"><span>Fila conjunta de pesquisa e auditoria</span><b>{(data?.researchableCount||0)+(data?.auditCount||0)}</b></div>{queue.map((i,idx)=><button key={i.id} onClick={()=>openIndicator(i.id)} className={idx===0?'selected':''}><div className="queue-code">{i.code}</div><span><strong>{i.name}</strong><small>ISO {i.standard?.code} · prioridade {i.priority}</small></span><StatusBadge status={i.status}/></button>)}{!queue.length&&<div className="empty-mini">Nenhuma lacuna elegível neste momento.</div>}</section>
      <section className="investigation-panel"><div className="investigation-top"><div><span className="eyebrow">Como o agente trabalha</span><h3>Investigação segura e rastreável</h3></div><Sparkles size={21}/></div><div className="agent-steps">{[['01','Entende a tarefa','Distingue lacuna de pesquisa de candidato que precisa de auditoria.'],['02','Prioriza fontes oficiais','Prefeitura, SAAE, IBGE, SINISA, DATASUS, INEP e outras bases públicas.'],['03','Compara e documenta','Registra valor, ano, URL, trecho de evidência e divergências encontradas.'],['04','Você decide','A descoberta ou auditoria fica pendente até a revisão humana.']].map(([n,t,d])=><div key={n}><b>{n}</b><span><strong>{t}</strong><small>{d}</small></span></div>)}</div><div className="flow-diagram"><span><Search/> Pesquisa</span><i>→</i><span><Database/> Descoberta</span><i>→</i><span><CheckCircle2/> Validação humana</span></div></section>
      <section className="runs-panel"><div className="workbench-title"><span>Execuções recentes</span></div>{runs.slice(0,7).map(r=><div className="run-row" key={r.id}><span className={`run-dot ${String(r.status||'failed').toLowerCase()}`}/><div><strong>{new Date(r.startedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</strong><small>{r.summary||r.status}</small></div><b>{r.candidatesCreated||0}</b></div>)}{!runs.length&&<div className="empty-mini">Nenhuma execução registrada ainda.</div>}<button className="secondary-btn wide" onClick={()=>go('findings')}>Abrir descobertas <ArrowRight size={16}/></button></section></div>
  </div>;
}
