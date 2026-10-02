import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { runResearchBatch } from '../services/agent.js';

export const agentRouter = Router();

agentRouter.get('/status', async (_req, res, next) => {
  try {
    const researchStatuses = ['NOT_STARTED', 'PARTIAL', 'NEEDS_REQUEST', 'REVIEW_NEEDED', 'IN_RESEARCH'];
    const [lastRun, runs, newFindings, queue, researchableCount, missingCount, partialCount] = await Promise.all([
      prisma.agentRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      prisma.agentRun.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
      prisma.agentFinding.count({ where: { status: 'NEW' } }),
      prisma.indicator.findMany({
        where: { status: { in: researchStatuses } },
        include: { standard: true, values: { where: { isCurrent: true }, take: 1 } },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
        take: 20,
      }),
      prisma.indicator.count({ where: { status: { in: researchStatuses } } }),
      prisma.indicator.count({ where: { status: { in: ['NOT_STARTED', 'NEEDS_REQUEST', 'IN_RESEARCH'] } } }),
      prisma.indicator.count({ where: { status: { in: ['PARTIAL', 'REVIEW_NEEDED'] } } }),
    ]);
    res.json({
      configured: Boolean(process.env.OPENAI_API_KEY || process.env.TAVILY_API_KEY),
      provider: process.env.OPENAI_API_KEY ? 'OpenAI + pesquisa web' : process.env.TAVILY_API_KEY ? 'Tavily' : 'Não configurado',
      model: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || 'gpt-5.6-sol') : null,
      lastRun, runs, newFindings,
      researchableCount,
      missingCount,
      partialCount,
      queue: queue.map((i) => ({ ...i, currentValue: i.values[0] || null, values: undefined })),
    });
  } catch (error) { next(error); }
});

agentRouter.post('/run', async (_req, res, next) => {
  try { res.json(await runResearchBatch({ mode: 'manual' })); }
  catch (error) { next(error); }
});
