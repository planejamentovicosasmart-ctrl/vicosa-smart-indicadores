import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboardRouter } from './routes/dashboard.js';
import { indicatorsRouter } from './routes/indicators.js';
import { findingsRouter } from './routes/findings.js';
import { agentRouter } from './routes/agent.js';
import { auxiliaryRouter } from './routes/auxiliary.js';
import { sourcesRouter } from './routes/sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));

function optionalBasicAuth(req, res, next) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass || req.path === '/api/health') return next();
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [u, p] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
    if (u === user && p === pass) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Central de Indicadores"');
  return res.status(401).send('Autenticação necessária');
}
app.use(optionalBasicAuth);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'vicosa-smart-indicadores', time: new Date().toISOString() }));
app.use('/api/dashboard', dashboardRouter);
app.use('/api/indicators', indicatorsRouter);
app.use('/api/findings', findingsRouter);
app.use('/api/agent', agentRouter);
app.use('/api/auxiliary', auxiliaryRouter);
app.use('/api/sources', sourcesRouter);

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

app.use((error, _req, res, _next) => {
  console.error(error);
  const message = error?.message || 'Erro interno';
  res.status(/não encontrad/i.test(message) ? 404 : 500).json({ error: message });
});
