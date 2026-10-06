import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ui-crash]', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <div style={{minHeight:'100vh',background:'#f4f7fb',display:'grid',placeItems:'center',padding:24}}>
      <div style={{maxWidth:620,width:'100%',background:'#fff',border:'1px solid #e4e9ef',borderRadius:18,padding:28,boxShadow:'0 18px 50px rgba(13,34,58,.08)'}}>
        <AlertTriangle size={28} style={{color:'#c98b22'}}/>
        <h2 style={{margin:'12px 0 6px',color:'#132a45'}}>Esta tela encontrou um dado inesperado</h2>
        <p style={{color:'#697b8e',lineHeight:1.6}}>O sistema continua disponível. Atualize a página; se o erro persistir, a mensagem abaixo ajuda a identificar o registro que causou o problema.</p>
        <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word',background:'#f7f9fb',padding:12,borderRadius:10,fontSize:12,color:'#8b3f3f'}}>{String(this.state.error?.message || this.state.error || 'Erro desconhecido')}</pre>
        <button className="primary-btn" onClick={()=>window.location.reload()}><RefreshCw size={16}/> Recarregar sistema</button>
      </div>
    </div>;
  }
}
