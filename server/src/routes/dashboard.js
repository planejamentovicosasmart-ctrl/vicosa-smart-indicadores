import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (_req, res, next) => {
  try {
    const [standards, statusGroups, findingsNew, findingsAwaiting, lastRun, recentHistory] = await Promise.all([
      prisma.standard.findMany({ include: { indicators: { select: { status: true } } }, orderBy: { code: 'asc' } }),
      prisma.indicator.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.agentFinding.count({ where: { status: 'NEW' } }),
      prisma.agentFinding.count({ where: { status: { in: ['ACCEPTED', 'AWAITING_VALIDATION'] } } }),
      prisma.agentRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      prisma.indicatorHistory.findMany({ include: { indicator: { include: { standard: true } } }, orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
    const status = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));
    const total = Object.values(status).reduce((a, b) => a + b, 0);
    const standardStats = standards.map((s) => {
      const counts = s.indicators.reduce((acc, i) => ((acc[i.status] = (acc[i.status] || 0) + 1), acc), {});
      const done = (counts.COMPLETE || 0) + (counts.VALIDATED || 0);
      return { id: s.id, code: s.code, title: s.title, subtitle: s.subtitle, description: s.description, total: s.indicators.length, complete: counts.COMPLETE || 0, validated: counts.VALIDATED || 0, partial: counts.PARTIAL || 0, notStarted: counts.NOT_STARTED || 0, progress: s.indicators.length ? Math.round((done / s.indicators.length) * 100) : 0 };
    });
    const attention = await prisma.indicator.findMany({ where: { status: { in: ['PARTIAL', 'REVIEW_NEEDED', 'NEEDS_REQUEST', 'AWAITING_VALIDATION', 'NOT_STARTED'] } }, include: { standard: true, values: { where: { isCurrent: true }, take: 1 } }, orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }], take: 8 });
    res.json({ total, counts: { complete: (status.COMPLETE || 0) + (status.VALIDATED || 0), partial: status.PARTIAL || 0, notFound: (status.NOT_STARTED || 0) + (status.IN_RESEARCH || 0), awaitingValidation: status.AWAITING_VALIDATION || 0, validated: status.VALIDATED || 0, needsRequest: status.NEEDS_REQUEST || 0, reviewNeeded: status.REVIEW_NEEDED || 0, discoveries: findingsNew, acceptedDiscoveries: findingsAwaiting }, standards: standardStats, lastRun, attention: attention.map((i) => ({ ...i, currentValue: i.values[0] || null, values: undefined })), recentHistory: recentHistory.map((h) => ({ id: h.id, action: h.action, actor: h.actor, details: h.details, createdAt: h.createdAt, indicator: { id: h.indicator.id, code: h.indicator.code, name: h.indicator.name, standard: h.indicator.standard.code } })) });
  } catch (error) { next(error); }
});
