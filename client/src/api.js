import { demoApi } from './demoApi.js';

const query = new URLSearchParams(window.location.search);
const demoMode = query.get('demo') === '1' || import.meta.env.VITE_DEMO_MODE === 'true';

async function realRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Erro ${response.status}`);
  return payload;
}

function demoRequest(path, options={}) {
  const [pathname, queryString=''] = path.split('?');
  const params = Object.fromEntries(new URLSearchParams(queryString));
  const method=(options.method||'GET').toUpperCase();
  if(pathname==='/dashboard') return demoApi.dashboard();
  if(pathname==='/indicators' && method==='GET') return demoApi.indicators(params);
  const indicatorMatch=pathname.match(/^\/indicators\/([^/]+)$/);
  if(indicatorMatch && method==='GET') return demoApi.indicator(indicatorMatch[1]);
  const researchMatch=pathname.match(/^\/indicators\/([^/]+)\/research$/);
  if(researchMatch) return demoApi.researchIndicator(researchMatch[1]);
  const templateMatch=pathname.match(/^\/indicators\/([^/]+)\/request-template$/);
  if(templateMatch) return demoApi.requestTemplate(templateMatch[1],params.targetField);
  if(pathname==='/findings' && method==='GET') return demoApi.findings(params.status);
  const findingAction=pathname.match(/^\/findings\/([^/]+)\/(accept|reject|later|validate)$/);
  if(findingAction){
    const [,id,action]=findingAction;
    return ({accept:demoApi.acceptFinding,reject:demoApi.rejectFinding,later:demoApi.laterFinding,validate:demoApi.validateFinding}[action]).call(demoApi,id);
  }
  if(pathname==='/agent/status') return demoApi.agentStatus();
  if(pathname==='/agent/run') return demoApi.runAgent();
  if(pathname==='/auxiliary') return demoApi.auxiliary(params);
  if(pathname==='/sources') return demoApi.sources();
  return Promise.reject(new Error('Função indisponível no modo demonstração.'));
}

async function request(path, options = {}) {
  return demoMode ? demoRequest(path, options) : realRequest(path, options);
}

export const isDemoMode = demoMode;

export const api = {
  dashboard: () => request('/dashboard'),
  indicators: (params = {}) => request(`/indicators?${new URLSearchParams(Object.entries(params).filter(([,v]) => v !== '' && v != null))}`),
  indicator: (id) => request(`/indicators/${id}`),
  researchIndicator: (id) => request(`/indicators/${id}/research`, { method: 'POST', body: '{}' }),
  requestTemplate: (id, targetField) => request(`/indicators/${id}/request-template?targetField=${targetField}`),
  findings: (status) => request(`/findings${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  acceptFinding: (id, reviewer = 'Equipe Viçosa SMART') => request(`/findings/${id}/accept`, { method: 'POST', body: JSON.stringify({ reviewer }) }),
  rejectFinding: (id, reason, reviewer = 'Equipe Viçosa SMART') => request(`/findings/${id}/reject`, { method: 'POST', body: JSON.stringify({ reviewer, reason }) }),
  laterFinding: (id, reviewer = 'Equipe Viçosa SMART') => request(`/findings/${id}/later`, { method: 'POST', body: JSON.stringify({ reviewer }) }),
  validateFinding: (id, reviewer = 'Equipe Viçosa SMART') => request(`/findings/${id}/validate`, { method: 'POST', body: JSON.stringify({ reviewer }) }),
  agentStatus: () => request('/agent/status'),
  runAgent: () => request('/agent/run', { method: 'POST', body: '{}' }),
  auxiliary: (params = {}) => request(`/auxiliary?${new URLSearchParams(Object.entries(params).filter(([,v]) => v !== '' && v != null))}`),
  sources: () => request('/sources'),
};
