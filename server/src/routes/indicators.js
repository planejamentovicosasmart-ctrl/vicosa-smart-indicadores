import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { buildRequestText, deriveIndicatorStatus } from '../utils/indicator.js';
import { runResearchBatch } from '../services/agent.js';

export const indicatorsRouter = Router();

function valuePresence(value) {
  return {
    numerator: Boolean(value?.numeratorRaw || value?.numeratorNumber !== null && value?.numeratorNumber !== undefined),
    denominator: Boolean(value?.denominatorRaw || value?.denominatorNumber !== null && value?.denominatorNumber !== undefined),
    final: Boolean(value?.finalRaw || value?.finalNumber !== null && value?.finalNumber !== undefined),
  };
}

indicatorsRouter.get('/', async (req, res, next) => {
  try {
    const { standard, status, q, source, page = '1', limit = '100' } = req.query;
    const take = Math.min(500, Math.max(1, Number(limit) || 100));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const where = {
      ...(standard ? { standard: { code: String(standard) } } : {}),
      ...(status ? (() => {
        const statuses = String(status).split(',').map((s) => s.trim()).filter(Boolean);
        return statuses.length > 1 ? { status: { in: statuses } } : { status: statuses[0] };
      })() : {}),
      ...(q ? { OR: [
        { name: { contains: String(q), mode: 'insensitive' } },
        { code: { contains: String(q), mode: 'insensitive' } },
        { numeratorDescription: { contains: String(q), mode: 'insensitive' } },
        { denominatorDescription: { contains: String(q), mode: 'insensitive' } },
        { notes: { contains: String(q), mode: 'insensitive' } },
      ] } : {}),
      ...(source ? { values: { some: { isCurrent: true, OR: [
        { numeratorSource: { contains: String(source), mode: 'insensitive' } },
        { denominatorSource: { contains: String(source), mode: 'insensitive' } },
      ] } } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.indicator.findMany({
        where, skip, take,
        include: {
          standard: true,
          values: { where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' } },
          _count: { select: { findings: { where: { status: { in: ['NEW', 'ACCEPTED', 'AWAITING_VALIDATION', 'DIVERGENCE'] } } } } },
        },
        orderBy: [{ standard: { code: 'asc' } }, { sourceRow: 'asc' }],
      }),
      prisma.indicator.count({ where }),
    ]);
    res.json({
      total, page: Number(page) || 1, limit: take,
      items: items.map((i) => {
        const currentValue = i.values[0] || null;
        return { ...i, currentValue, presence: valuePresence(currentValue), findingCount: i._count.findings, values: undefined, _count: undefined };
      }),
    });
  } catch (error) { next(error); }
});

indicatorsRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.indicator.findUnique({
      where: { id: req.params.id },
      include: {
        standard: true,
        values: { orderBy: [{ isCurrent: 'desc' }, { createdAt: 'desc' }] },
        findings: { orderBy: { createdAt: 'desc' }, take: 30, include: { evidence: true } },
        evidence: { orderBy: { createdAt: 'desc' }, take: 30 },
        history: { orderBy: { createdAt: 'desc' }, take: 50 },
        auxiliary: { take: 20 },
      },
    });
    if (!item) return res.status(404).json({ error: 'Indicador não encontrado' });
    const currentValue = item.values.find((v) => v.isCurrent) || item.values[0] || null;
    const yearsCompatible = currentValue?.numeratorYear && currentValue?.denominatorYear
      ? currentValue.numeratorYear === currentValue.denominatorYear : null;
    const quality = {
      yearsCompatible,
      hasNumeratorSource: Boolean(currentValue?.numeratorSource),
      hasDenominatorSource: Boolean(currentValue?.denominatorSource),
      hasFinalSource: Boolean(currentValue?.finalSource),
      hasFormula: Boolean(currentValue?.finalFormula || item.formula),
      hasEvidence: item.evidence.length > 0,
      validationState: currentValue?.validationState || null,
      origin: currentValue?.origin || null,
    };
    res.json({ ...item, currentValue, quality });
  } catch (error) { next(error); }
});

indicatorsRouter.post('/:id/research', async (req, res, next) => {
  try {
    const hint = req.body?.hint ? String(req.body.hint).slice(0, 2000) : null;
    const result = await runResearchBatch({ indicatorId: req.params.id, mode: 'all', hint });
    res.json(result);
  } catch (error) { next(error); }
});

indicatorsRouter.post('/:id/approve-current', async (req, res, next) => {
  const reviewer = req.body?.reviewer || 'Equipe Viçosa SMART';
  try {
    const item = await prisma.indicator.findUnique({
      where: { id: req.params.id },
      include: { values: { where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' } } },
    });
    if (!item) return res.status(404).json({ error: 'Indicador não encontrado' });
    const current = item.values[0];
    if (!current) return res.status(400).json({ error: 'Não há candidato atual para aprovar' });
    await prisma.$transaction([
      prisma.indicatorValue.update({
        where: { id: current.id },
        data: { validationState: 'VALIDATED', validatedAt: new Date(), validatedBy: reviewer },
      }),
      prisma.indicator.update({ where: { id: item.id }, data: { status: 'VALIDATED', nextSearchAt: null } }),
      prisma.indicatorHistory.create({
        data: { indicatorId: item.id, action: 'CURRENT_VALUE_VALIDATED', actor: reviewer, details: { valueId: current.id, origin: current.origin || null } },
      }),
    ]);
    res.json({ ok: true, status: 'VALIDATED' });
  } catch (error) { next(error); }
});

indicatorsRouter.post('/:id/reject-current', async (req, res, next) => {
  const reviewer = req.body?.reviewer || 'Equipe Viçosa SMART';
  const reason = String(req.body?.reason || 'Candidato descartado durante auditoria');
  try {
    const item = await prisma.indicator.findUnique({
      where: { id: req.params.id },
      include: { values: { where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' } } },
    });
    if (!item) return res.status(404).json({ error: 'Indicador não encontrado' });
    const current = item.values[0];
    if (current) await prisma.indicatorValue.update({ where: { id: current.id }, data: { isCurrent: false, validationState: 'SUPERSEDED' } });
    await prisma.indicator.update({ where: { id: item.id }, data: { status: 'NOT_STARTED', nextSearchAt: null, priority: 100 } });
    await prisma.indicatorHistory.create({
      data: { indicatorId: item.id, action: 'CURRENT_VALUE_REJECTED', actor: reviewer, details: { valueId: current?.id || null, reason } },
    });
    res.json({ ok: true, status: 'NOT_STARTED' });
  } catch (error) { next(error); }
});

indicatorsRouter.get('/:id/request-template', async (req, res, next) => {
  try {
    const item = await prisma.indicator.findUnique({ where: { id: req.params.id }, include: { standard: true } });
    if (!item) return res.status(404).json({ error: 'Indicador não encontrado' });
    const targetField = String(req.query.targetField || 'NUMERATOR').toUpperCase();
    res.json({ targetField, text: buildRequestText(item, targetField) });
  } catch (error) { next(error); }
});

indicatorsRouter.patch('/:id/notes', async (req, res, next) => {
  try {
    const notes = String(req.body.notes ?? '');
    const updated = await prisma.indicator.update({ where: { id: req.params.id }, data: { notes } });
    await prisma.indicatorHistory.create({ data: { indicatorId: updated.id, action: 'NOTES_UPDATED', actor: req.body.actor || 'Usuário', details: { notes } } });
    res.json(updated);
  } catch (error) { next(error); }
});

indicatorsRouter.post('/:id/recalculate-status', async (req, res, next) => {
  try {
    const item = await prisma.indicator.findUnique({ where: { id: req.params.id }, include: { values: { where: { isCurrent: true }, take: 1 }, findings: true } });
    if (!item) return res.status(404).json({ error: 'Indicador não encontrado' });
    const status = deriveIndicatorStatus(item.values[0], item.findings);
    await prisma.indicator.update({ where: { id: item.id }, data: { status } });
    res.json({ status });
  } catch (error) { next(error); }
});
