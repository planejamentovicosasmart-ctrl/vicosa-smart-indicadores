import { LayoutDashboard, BarChart3, Sparkles, Inbox, Database, LibraryBig, PanelLeftClose, PanelLeftOpen, FileBarChart2 } from 'lucide-react';

const nav = [
  ['dashboard', 'Visão geral', LayoutDashboard],
  ['abnt', 'Indicadores ABNT', BarChart3],
  ['auxiliary', 'Indicadores auxiliares', LibraryBig],
  ['agent', 'Agente de pesquisa', Sparkles],
  ['findings', 'Descobertas', Inbox],
  ['sources', 'Fontes e evidências', Database],
  ['reports', 'Relatórios', FileBarChart2],
];

export function Sidebar({ view, setView, collapsed, setCollapsed, discoveryCount = 0 }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-mark">VS</div>
        {!collapsed && <div><strong>Viçosa SMART</strong><span>Central de Indicadores</span></div>}
      </div>
      <nav className="nav-list">
        {nav.map(([key, label, Icon]) => (
          <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => setView(key)} title={collapsed ? label : undefined}>
            <Icon size={19}/><span>{label}</span>
            {key === 'findings' && discoveryCount > 0 && <b className="nav-count">{discoveryCount}</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="city-chip">{!collapsed && <span><strong>Viçosa</strong><small>Minas Gerais</small></span>}<i/></div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher menu">
          {collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>} {!collapsed && 'Recolher menu'}
        </button>
      </div>
    </aside>
  );
}
