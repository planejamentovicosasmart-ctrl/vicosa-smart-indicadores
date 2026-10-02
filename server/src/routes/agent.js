import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { runResearchBatch } from '../services/agent.js';

export const agentRouter = Router();

agentRouter.get('/status', async (_req, res, next) => {
  try {
    const searchStatuses = ['NOT_STARTED', 'PARTIAL', 'NEEDS_REQUEST', 'REVIEW_NEEDED', 'IN_RESEARCH'];
    const queueStatuses = ['AWAITING_VALIDATION', ...searchStatuses];
    const [lastRun, runs, newFindings, queue, researchableCount, missingCount, partialCount, auditCount] = await Promise.all([
      prisma.agentRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      prisma.agentRun.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
      prisma.agentFinding.count({ where: { status: 'NEW' } }),
      prisma.indicator.findMany({
        where: { status: { in: queueStatuses } },
        include: { standard: true, values: { where: { isCurrent: true }, take: 1 } },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
        take: 24,
      }),
      prisma.indicator.count({ where: { status: { in: searchStatuses } } }),
      prisma.indicator.count({ where: { status: { in: ['NOT_STARTED', 'NEEDS_REQUEST', 'IN_RESEARCH'] } } }),
      prisma.indicator.count({ where: { status: { in: ['PARTIAL', 'REVIEW_NEEDED'] } } }),
      prisma.indicator.count({ where: { status: 'AWAITING_VALIDATION' } }),
    ]);
    res.json({
      configured: Boolean(process.env.OPENAI_API_KEY || process.env.TAVILY_API_KEY),
      provider: process.env.OPENAI_API_KEY ? 'OpenAI + pesquisa web' : process.env.TAVILY_API_KEY ? 'Tavily' : 'Não configurado',
      model: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || 'gpt-5.6-sol') : null,
      lastRun, runs, newFindings,
      researchableCount,
      missingCount,
      partialCount,
      auditCount,
      queue: queue.map((i) => ({ ...i, currentValue: i.values[0] || null, values: undefined })),
    });
  } catch (error) { next(error); }
});

agentRouter.post('/run', async (req, res, next) => {
  try {
    const mode = ['search','audit','all'].includes(String(req.body?.mode || '')) ? String(req.body.mode) : 'all';
    const hint = req.body?.hint ? String(req.body.hint).slice(0, 2000) : null;
    res.json(await runResearchBatch({ mode, hint }));
  } catch (error) { next(error); }
});
