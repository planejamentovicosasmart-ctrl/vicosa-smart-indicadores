const standardsMeta = {
  '37120': { id:'std-37120', code:'37120', title:'ABNT NBR ISO 37120', subtitle:'Cidades Sustentáveis', description:'Indicadores para serviços urbanos e qualidade de vida.' },
  '37122': { id:'std-37122', code:'37122', title:'ABNT NBR ISO 37122', subtitle:'Cidades Inteligentes', description:'Indicadores para cidades inteligentes e transformação digital.' },
  '37123': { id:'std-37123', code:'37123', title:'ABNT NBR ISO 37123', subtitle:'Cidades Resilientes', description:'Indicadores para resiliência, riscos e continuidade urbana.' },
};

let cache;
let demoFindings;
const now = () => new Date().toISOString();
const cleanYear = (v) => v == null ? null : String(v).replace(/\.0$/, '');

async function load() {
  if (cache) return cache;
  if (typeof DecompressionStream === 'undefined') throw new Error('Seu navegador não suporta a descompactação do modo demonstração. Use uma versão recente do Chrome/Edge.');
  const partNames = ['/seed.gz.b64.part1.txt','/seed.gz.b64.part2.txt','/seed.gz.b64.part3.txt','/seed.gz.b64.part4.txt'];
  const responses = await Promise.all(partNames.map((url) => fetch(url)));
  if (responses.some((r) => !r.ok)) throw new Error('Não foi possível carregar os dados de demonstração.');
  const base64 = (await Promise.all(responses.map((r) => r.text()))).join('').trim();
  const binary = atob(base64);
  const compressed = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const seed = JSON.parse(await new Response(stream).text());
  const indicators = seed.indicators.map((i, idx) => ({
    id: `demo-ind-${idx+1}`,
    ...i,
    status: i.status || 'NOT_STARTED',
    priority: i.status === 'PARTIAL' ? 90 : i.status === 'NOT_STARTED' ? 70 : 50,
    unit: i.unit || '',
    standard: standardsMeta[i.standard],
    currentValue: {
      id: `demo-val-${idx+1}`,
      indicatorId: `demo-ind-${idx+1}`,
      numeratorRaw: i.numeratorRaw,
      numeratorNumber: i.numeratorNumber,
      numeratorYear: cleanYear(i.numeratorYear),
      denominatorRaw: i.denominatorRaw,
      denominatorNumber: i.denominatorNumber,
      denominatorYear: cleanYear(i.denominatorYear),
      numeratorSource: i.numeratorSource,
      denominatorSource: i.denominatorSource,
      numeratorSourceUrl: null,
      denominatorSourceUrl: null,
      finalRaw: i.finalRaw,
      finalNumber: i.finalNumber,
      finalFormula: i.finalFormula,
      validationState: i.status === 'VALIDATED' ? 'VALIDATED' : 'DRAFT',
      isCurrent: true,
    },
    findings: [], evidence: [], auxiliary: [],
    history: [{ id:`hist-${idx+1}`, action:'IMPORTED_FROM_SPREADSHEET', actor:'Modo demonstração', createdAt: now(), details:{} }],
  }));

  const byStdCode = new Map(indicators.map(i => [`${i.standard.code}:${i.code}`, i]));
  const auxiliary = seed.auxiliary.map((a, idx) => {
    const rel = a.related?.[0];
    return {
      id:`demo-aux-${idx+1}`, ...a,
      referenceDate: a.referenceDate || null,
      relatedIndicator: rel ? byStdCode.get(`${rel.standard}:${rel.code}`) || null : null,
    };
  });

  const candidates = indicators.filter(i => ['PARTIAL','NOT_STARTED'].includes(i.status)).slice(0,4);
  demoFindings = candidates.map((i, idx) => ({
    id:`demo-find-${idx+1}`,
    indicatorId:i.id,
    indicator:i,
    targetField: i.currentValue?.numeratorRaw || i.currentValue?.numeratorNumber != null ? 'DENOMINATOR' : 'NUMERATOR',
    candidateValueRaw: idx === 0 ? 'Exemplo de valor candidato' : null,
    candidateValueNumber: null,
    unit:i.unit || null,
    referenceYear:'2024',
    sourceName: idx % 2 === 0 ? 'Fonte oficial — demonstração' : 'Base pública — demonstração',
    sourceOrganization:'Exemplo visual; não é dado oficial',
    sourceType:'DEMO',
    sourceUrl:null,
    evidenceExcerpt:'Conteúdo fictício apenas para demonstrar como uma descoberta aparecerá antes da validação humana.',
    confidenceLevel: idx < 2 ? 'HIGH' : 'MEDIUM',
    confidenceScore: idx < 2 ? 88 : 72,
    confidenceReason:'Exemplo visual do mecanismo de confiança. Não representa pesquisa real.',
    status: idx === 1 ? 'AWAITING_VALIDATION' : 'NEW',
    createdAt:now(),
  }));
  demoFindings.forEach(f => f.indicator.findings.push(f));
  cache = { seed, indicators, auxiliary };
  return cache;
}

function presence(v) {
  return {
    numerator: Boolean(v?.numeratorRaw || (v?.numeratorNumber !== null && v?.numeratorNumber !== undefined)),
    denominator: Boolean(v?.denominatorRaw || (v?.denominatorNumber !== null && v?.denominatorNumber !== undefined)),
    final: Boolean(v?.finalRaw || (v?.finalNumber !== null && v?.finalNumber !== undefined)),
  };
}

function addDemoBanner() {
  if (document.getElementById('demo-mode-banner')) return;
  const el = document.createElement('div');
  el.id = 'demo-mode-banner';
  el.textContent = 'MODO DEMONSTRAÇÃO  •  Interface local sem banco de dados';
  Object.assign(el.style,{position:'fixed',left:'50%',bottom:'16px',transform:'translateX(-50%)',zIndex:'9999',padding:'9px 14px',borderRadius:'999px',font:'600 12px system-ui',background:'rgba(12,34,51,.92)',color:'#fff',boxShadow:'0 8px 30px rgba(0,0,0,.18)',letterSpacing:'.02em'});
  document.body.appendChild(el);
}

export const demoApi = {
  async dashboard(){
    addDemoBanner();
    const {indicators}=await load();
    const statusCounts = indicators.reduce((a,i)=>(a[i.status]=(a[i.status]||0)+1,a),{});
    const standards = Object.values(standardsMeta).map(s=>{
      const list=indicators.filter(i=>i.standard.code===s.code);
      const counts=list.reduce((a,i)=>(a[i.status]=(a[i.status]||0)+1,a),{});
      const complete=(counts.COMPLETE||0), validated=(counts.VALIDATED||0);
      return {...s,total:list.length,complete,validated,partial:counts.PARTIAL||0,notStarted:counts.NOT_STARTED||0,progress:list.length?Math.round(((complete+validated)/list.length)*100):0};
    });
    return {
      total: indicators.length,
      counts:{
        complete:(statusCounts.COMPLETE||0)+(statusCounts.VALIDATED||0),
        partial:statusCounts.PARTIAL||0,
        notFound:(statusCounts.NOT_STARTED||0)+(statusCounts.IN_RESEARCH||0),
        awaitingValidation:statusCounts.AWAITING_VALIDATION||0,
        validated:statusCounts.VALIDATED||0,
        needsRequest:statusCounts.NEEDS_REQUEST||0,
        reviewNeeded:statusCounts.REVIEW_NEEDED||0,
        discoveries:demoFindings.filter(f=>f.status==='NEW').length,
        acceptedDiscoveries:demoFindings.filter(f=>f.status==='AWAITING_VALIDATION').length,
      },
      standards,
      lastRun:null,
      attention: indicators.filter(i=>['PARTIAL','NOT_STARTED','REVIEW_NEEDED','NEEDS_REQUEST'].includes(i.status)).sort((a,b)=>b.priority-a.priority).slice(0,8),
      recentHistory:[],
    };
  },
  async indicators(params={}){
    addDemoBanner(); const {indicators}=await load();
    const q=String(params.q||'').toLowerCase();
    let items=indicators.filter(i=>(!params.standard||i.standard.code===String(params.standard))&&(!params.status||i.status===params.status)&&(!q||[i.name,i.code,i.numeratorDescription,i.denominatorDescription,i.notes].some(v=>String(v||'').toLowerCase().includes(q))));
    return { total:items.length,page:1,limit:250,items:items.map(i=>({...i,presence:presence(i.currentValue),findingCount:i.findings.length})) };
  },
  async indicator(id){
    addDemoBanner(); const {indicators}=await load(); const i=indicators.find(x=>x.id===id); if(!i) throw new Error('Indicador não encontrado');
    const v=i.currentValue; const yearsCompatible=v?.numeratorYear&&v?.denominatorYear ? v.numeratorYear===v.denominatorYear : null;
    return {...i, quality:{yearsCompatible,hasNumeratorSource:Boolean(v?.numeratorSource),hasDenominatorSource:Boolean(v?.denominatorSource),hasFormula:Boolean(v?.finalFormula||i.formula),hasEvidence:i.evidence.length>0,validationState:v?.validationState||null}};
  },
  async researchIndicator(){ throw new Error('Pesquisa real disponível após configurar o banco e a chave do agente.'); },
  async requestTemplate(id,targetField){ const i=await this.indicator(id); const desc=targetField==='DENOMINATOR'?i.denominatorDescription:i.numeratorDescription; return {targetField,text:`SOLICITAÇÃO — DEMONSTRAÇÃO\n\nPara fins de cálculo do indicador ${i.code} da ABNT NBR ISO ${i.standard.code}, solicitamos a informação: ${desc||'dado necessário para o indicador'}, com ano de referência, unidade e documento comprobatório.`}; },
  async findings(status){ addDemoBanner(); await load(); const wanted=String(status||'').split(',').filter(Boolean); const items=wanted.length?demoFindings.filter(f=>wanted.includes(f.status)):demoFindings; return {items}; },
  async acceptFinding(id){ await load(); const f=demoFindings.find(x=>x.id===id); if(f)f.status='AWAITING_VALIDATION'; return f; },
  async rejectFinding(id){ await load(); const f=demoFindings.find(x=>x.id===id); if(f)f.status='REJECTED'; return f; },
  async laterFinding(id){ await load(); const f=demoFindings.find(x=>x.id===id); if(f)f.status='INVESTIGATE_LATER'; return f; },
  async validateFinding(id){ await load(); const f=demoFindings.find(x=>x.id===id); if(f)f.status='VALIDATED'; return f; },
  async agentStatus(){ addDemoBanner(); const {indicators}=await load(); return {configured:false,provider:'Modo demonstração — pesquisa real desativada',model:null,lastRun:null,runs:[],newFindings:demoFindings.filter(f=>f.status==='NEW').length,queue:indicators.filter(i=>!['VALIDATED','NOT_APPLICABLE'].includes(i.status)).sort((a,b)=>b.priority-a.priority).slice(0,12)}; },
  async runAgent(){ throw new Error('O agente real será ativado depois da configuração do banco e da chave de pesquisa.'); },
  async auxiliary(params={}){ addDemoBanner(); const {auxiliary}=await load(); const q=String(params.q||'').toLowerCase(); const category=String(params.category||''); let items=auxiliary.filter(i=>(!q||String(i.name||'').toLowerCase().includes(q))&&(!category||i.category===category)); const groups=new Map(); auxiliary.forEach(i=>groups.set(i.category||'Outros',(groups.get(i.category||'Outros')||0)+1)); return {total:items.length,categories:[...groups].map(([name,count])=>({name,count})).sort((a,b)=>a.name.localeCompare(b.name)),items}; },
  async sources(){ addDemoBanner(); const {indicators}=await load(); const map=new Map(); indicators.forEach(i=>{const v=i.currentValue; [[v?.numeratorSource,i.id],[v?.denominatorSource,i.id]].forEach(([name,id])=>{if(!name)return;const k=name.trim().toLowerCase();const x=map.get(k)||{name:name.trim(),urls:[],ids:new Set(),uses:0,findings:0};x.ids.add(id);x.uses++;map.set(k,x);});}); return {items:[...map.values()].map(x=>({name:x.name,urls:x.urls,indicatorCount:x.ids.size,uses:x.uses,findings:x.findings})).sort((a,b)=>b.indicatorCount-a.indicatorCount)}; },
};
