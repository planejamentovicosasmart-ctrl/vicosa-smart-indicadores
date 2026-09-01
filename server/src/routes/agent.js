import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { runResearchBatch } from '../services/agent.js';

export const agentRouter = Router();

agentRouter.get('/status', async (_req, res, next) => {
  try {
    const [lastRun, runs, newFindings, queue] = await Promise.all([
      prisma.agentRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      prisma.agentRun.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
      prisma.agentFinding.count({ where: { status: 'NEW' } }),
      prisma.indicator.findMany({
        where: { status: { notIn: ['VALIDATED', 'NOT_APPLICABLE'] } },
        include: { standard: true, values: { where: { isCurrent: true }, take: 1 } },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
        take: 12,
      }),
    ]);
    res.json({
      configured: Boolean(process.env.OPENAI_API_KEY || process.env.TAVILY_API_KEY),
      provider: process.env.OPENAI_API_KEY ? 'OpenAI + pesquisa web' : process.env.TAVILY_API_KEY ? 'Tavily' : 'Não configurado',
      model: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || 'gpt-5.6-luna') : null,
      lastRun, runs, newFindings,
      queue: queue.map((i) => ({ ...i, currentValue: i.values[0] || null, values: undefined })),
    });
  } catch (error) { next(error); }
});

agentRouter.post('/run', async (_req, res, next) => {
  try { res.json(await runResearchBatch({ mode: 'manual' })); }
  catch (error) { next(error); }
});
