import { Search, Bell, MapPin } from 'lucide-react';

export function Topbar({ search, setSearch, onSearch, discoveryCount = 0 }) {
  return (
    <header className="topbar">
      <form className="global-search" onSubmit={(e) => { e.preventDefault(); onSearch?.(); }}>
        <Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar indicador, código, fonte..." />
        <kbd>Enter</kbd>
      </form>
      <div className="topbar-actions">
        <span className="location"><MapPin size={16}/> Viçosa · MG</span>
        <button className="icon-btn" title="Descobertas"><Bell size={18}/>{discoveryCount > 0 && <i>{discoveryCount}</i>}</button>
        <div className="avatar">VS</div>
      </div>
    </header>
  );
}
