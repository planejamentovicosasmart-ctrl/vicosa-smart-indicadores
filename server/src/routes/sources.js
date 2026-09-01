import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const sourcesRouter = Router();

sourcesRouter.get('/', async (_req, res, next) => {
  try {
    const [values, findings] = await Promise.all([
      prisma.indicatorValue.findMany({ where: { isCurrent: true }, select: { numeratorSource: true, denominatorSource: true, numeratorSourceUrl: true, denominatorSourceUrl: true, indicatorId: true } }),
      prisma.agentFinding.findMany({ where: { status: { not: 'REJECTED' } }, select: { sourceName: true, sourceUrl: true, indicatorId: true, confidenceLevel: true } }),
    ]);
    const map = new Map();
    const add = (name, url, indicatorId, type = 'base') => {
      if (!name) return;
      const key = String(name).trim().toLowerCase();
      const item = map.get(key) || { name: String(name).trim(), urls: new Set(), indicators: new Set(), findings: 0, validatedUses: 0 };
      if (url) item.urls.add(url);
      item.indicators.add(indicatorId);
      if (type === 'finding') item.findings++; else item.validatedUses++;
      map.set(key, item);
    };
    for (const v of values) { add(v.numeratorSource, v.numeratorSourceUrl, v.indicatorId); add(v.denominatorSource, v.denominatorSourceUrl, v.indicatorId); }
    for (const f of findings) add(f.sourceName, f.sourceUrl, f.indicatorId, 'finding');
    const items = [...map.values()].map((x) => ({ name: x.name, urls: [...x.urls], indicatorCount: x.indicators.size, findings: x.findings, uses: x.validatedUses })).sort((a, b) => b.indicatorCount - a.indicatorCount);
    res.json({ items });
  } catch (error) { next(error); }
});
