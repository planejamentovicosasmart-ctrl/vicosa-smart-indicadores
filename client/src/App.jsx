import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar.jsx';
import { Topbar } from './components/Topbar.jsx';
import { IndicatorDrawer } from './components/IndicatorDrawer.jsx';
import { DashboardView } from './views/DashboardView.jsx';
import { AbntView } from './views/AbntView.jsx';
import { AuxiliaryView } from './views/AuxiliaryView.jsx';
import { AgentView } from './views/AgentView.jsx';
import { FindingsView } from './views/FindingsView.jsx';
import { SourcesView } from './views/SourcesView.jsx';
import { ReportsView } from './views/ReportsView.jsx';
import { api } from './api.js';

export default function App(){
  const [view,setView]=useState('dashboard'); const [collapsed,setCollapsed]=useState(false); const [search,setSearch]=useState(''); const [searched,setSearched]=useState(''); const [indicatorId,setIndicatorId]=useState(null); const [standard,setStandard]=useState('37120'); const [refreshKey,setRefreshKey]=useState(0); const [discoveryCount,setDiscoveryCount]=useState(0);
  const go=(next,arg)=>{if(arg)setStandard(arg);setView(next)}; const refresh=()=>setRefreshKey(k=>k+1);
  useEffect(()=>{ api.dashboard().then(d=>d&&setDiscoveryCount(d.counts?.discoveries||0)).catch(()=>{}); },[refreshKey]);
  const doSearch=()=>{setSearched(search);setView('abnt')};
  return <div className="app-shell"><Sidebar view={view} setView={setView} collapsed={collapsed} setCollapsed={setCollapsed} discoveryCount={discoveryCount}/><main className="main-area"><Topbar search={search} setSearch={setSearch} onSearch={doSearch} discoveryCount={discoveryCount}/>{view==='dashboard'&&<DashboardView openIndicator={setIndicatorId} go={go} refreshKey={refreshKey}/>} {view==='abnt'&&<AbntView openIndicator={setIndicatorId} initialStandard={standard} globalSearch={searched} refreshKey={refreshKey}/>} {view==='auxiliary'&&<AuxiliaryView globalSearch={searched}/>} {view==='agent'&&<AgentView openIndicator={setIndicatorId} go={go} refreshKey={refreshKey} onChanged={refresh}/>} {view==='findings'&&<FindingsView openIndicator={setIndicatorId} refreshKey={refreshKey} onChanged={refresh}/>} {view==='sources'&&<SourcesView/>} {view==='reports'&&<ReportsView/>}</main><IndicatorDrawer indicatorId={indicatorId} onClose={()=>setIndicatorId(null)} onChanged={refresh}/></div>
}
