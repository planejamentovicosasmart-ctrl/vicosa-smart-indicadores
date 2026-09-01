import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const auxiliaryRouter = Router();

auxiliaryRouter.get('/', async (req, res, next) => {
  try {
    const { q, category, available } = req.query;
    const where = {
      ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
      ...(category ? { category: String(category) } : {}),
      ...(available === 'true' ? { available: true } : available === 'false' ? { available: false } : {}),
    };
    const [items, groups, total] = await Promise.all([
      prisma.auxiliaryIndicator.findMany({ where, include: { relatedIndicator: { include: { standard: true } } }, orderBy: [{ category: 'asc' }, { sourceRow: 'asc' }], take: 500 }),
      prisma.auxiliaryIndicator.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { category: 'asc' } }),
      prisma.auxiliaryIndicator.count({ where }),
    ]);
    res.json({ total, categories: groups.map((g) => ({ name: g.category || 'Outros', count: g._count._all })), items });
  } catch (error) { next(error); }
});
