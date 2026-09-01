import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, Clock3, ShieldCheck, Search, ArrowRight, Bot, Sparkles, AlertCircle, DatabaseZap } from 'lucide-react';
import { api } from '../api.js';
import { ProgressRing } from '../components/ProgressRing.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';

export function DashboardView({ openIndicator, go, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.dashboard().then(setData).catch((e) => setError(e.message)); }, [refreshKey]);
  if (error) return <div className="state-card error-state"><AlertCircle/> {error}</div>;
  if (!data) return <div className="skeleton-page"><div/><div/><div/></div>;
  const metrics = [
    ['Encontrados', data.counts.complete, 'Indicadores com dados suficientes', CheckCircle2, 'green'],
    ['Parciais', data.counts.partial, 'Ainda falta uma parte do cálculo', CircleDashed, 'amber'],
    ['Não encontrados', data.counts.notFound, 'Na fila de investigação', Search, 'blue'],
    ['Aguardando validação', data.counts.awaitingValidation, 'Descobertas aceitas pela equipe', Clock3, 'purple'],
    ['Validados', data.counts.validated, 'Dados aprovados para uso', ShieldCheck, 'teal'],
  ];
  return <div className="page-content">
    <section className="hero-section">
      <div><span className="eyebrow">Cidades sustentáveis, inteligentes e resilientes</span><h1>Central de Indicadores</h1><p>Uma visão única do que já temos, do que ainda falta e do que o agente encontrou para Viçosa.</p></div>
      <button className="agent-pill" onClick={() => go('agent')}><Sparkles size={17}/><span><strong>Agente de pesquisa</strong><small>{data.lastRun ? `Última execução ${new Date(data.lastRun.startedAt).toLocaleDateString('pt-BR')}` : 'Pronto para investigar'}</small></span><ArrowRight size={17}/></button>
    </section>

    <section className="metrics-grid">{metrics.map(([label,value,desc,Icon,tone]) => <article className="metric-card" key={label}><div className={`metric-icon ${tone}`}><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong><small>{desc}</small></div></article>)}</section>

    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">Normas ABNT ISO</span><h2>Progresso por norma</h2></div><button className="text-button" onClick={() => go('abnt')}>Ver todos <ArrowRight size={15}/></button></div>
      <div className="standards-grid">{data.standards.map((s,idx) => <article className={`standard-card standard-${idx+1}`} key={s.code} onClick={() => go('abnt', s.code)}>
        <div className="standard-top"><div><span>ABNT NBR ISO</span><strong>{s.code}</strong></div><ProgressRing value={s.progress}/></div>
        <h3>{s.subtitle}</h3><p>{s.description}</p>
        <div className="standard-stats"><span><b>{s.complete+s.validated}</b> encontrados</span><span><b>{s.partial}</b> parciais</span><span><b>{s.notStarted}</b> pendentes</span></div>
      </article>)}</div>
    </section>

    <div className="dashboard-split">
      <section className="panel-card">
        <div className="panel-title"><div><span className="eyebrow">Prioridade</span><h3>Indicadores que precisam de atenção</h3></div><DatabaseZap size={20}/></div>
        <div className="attention-list">{data.attention.slice(0,6).map((i) => <button key={i.id} onClick={() => openIndicator(i.id)}><div className="code-square">{i.code}</div><span><strong>{i.name}</strong><small>ISO {i.standard.code} · prioridade {i.priority}</small></span><StatusBadge status={i.status}/><ArrowRight size={16}/></button>)}</div>
      </section>
      <section className="panel-card agent-summary-card">
        <div className="panel-title"><div><span className="eyebrow">Pesquisa automática</span><h3>Atividade do agente</h3></div><Bot size={21}/></div>
        <div className="agent-orbit"><div><Bot size={27}/></div><span className="pulse p1"/><span className="pulse p2"/><span className="pulse p3"/></div>
        <div className="agent-numbers"><div><strong>{data.counts.discoveries}</strong><span>novas descobertas</span></div><div><strong>{data.lastRun?.indicatorsChecked || 0}</strong><span>analisados na última execução</span></div><div><strong>{data.lastRun?.candidatesCreated || 0}</strong><span>candidatos encontrados</span></div></div>
        <button className="primary-btn wide" onClick={() => go('findings')}>Revisar descobertas <ArrowRight size={16}/></button>
      </section>
    </div>
  </div>;
}
