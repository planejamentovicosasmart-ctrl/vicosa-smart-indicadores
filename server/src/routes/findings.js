import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const findingsRouter = Router();

findingsRouter.get('/', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status).split(',') : null;
    const items = await prisma.agentFinding.findMany({ where: status ? { status: { in: status } } : {}, include: { indicator: { include: { standard: true, values: { where: { isCurrent: true }, take: 1 } } }, evidence: true }, orderBy: [{ createdAt: 'desc' }], take: 300 });
    res.json({ items: items.map((f) => ({ ...f, indicator: { ...f.indicator, currentValue: f.indicator.values[0] || null, values: undefined } })) });
  } catch (error) { next(error); }
});

findingsRouter.post('/:id/accept', async (req, res, next) => {
  try {
    const finding = await prisma.agentFinding.update({ where: { id: req.params.id }, data: { status: 'AWAITING_VALIDATION', reviewedAt: new Date(), reviewedBy: req.body.reviewer || 'Usuário' }, include: { indicator: true } });
    await prisma.indicator.update({ where: { id: finding.indicatorId }, data: { status: 'AWAITING_VALIDATION' } });
    await prisma.indicatorHistory.create({ data: { indicatorId: finding.indicatorId, action: 'FINDING_ACCEPTED', actor: req.body.reviewer || 'Usuário', details: { findingId: finding.id } } });
    res.json(finding);
  } catch (error) { next(error); }
});

findingsRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const reason = String(req.body.reason || 'Não informado');
    const finding = await prisma.agentFinding.update({ where: { id: req.params.id }, data: { status: 'REJECTED', rejectionReason: reason, reviewedAt: new Date(), reviewedBy: req.body.reviewer || 'Usuário' } });
    await prisma.indicatorHistory.create({ data: { indicatorId: finding.indicatorId, action: 'FINDING_REJECTED', actor: req.body.reviewer || 'Usuário', details: { findingId: finding.id, reason } } });
    res.json(finding);
  } catch (error) { next(error); }
});

findingsRouter.post('/:id/later', async (req, res, next) => {
  try { const finding = await prisma.agentFinding.update({ where: { id: req.params.id }, data: { status: 'INVESTIGATE_LATER', reviewedAt: new Date(), reviewedBy: req.body.reviewer || 'Usuário' } }); res.json(finding); }
  catch (error) { next(error); }
});

findingsRouter.post('/:id/validate', async (req, res, next) => {
  const reviewer = req.body.reviewer || 'Usuário';
  try {
    const result = await prisma.$transaction(async (tx) => {
      const finding = await tx.agentFinding.findUnique({ where: { id: req.params.id }, include: { indicator: { include: { values: { where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' } } } } } });
      if (!finding) throw new Error('Descoberta não encontrada');
      if (!['AWAITING_VALIDATION', 'ACCEPTED', 'NEW', 'IN_REVIEW'].includes(finding.status)) throw new Error('Descoberta não está disponível para validação');
      if (!['NUMERATOR', 'DENOMINATOR', 'FINAL', 'UPDATE'].includes(finding.targetField)) throw new Error('Esta descoberta é apenas uma pista de fonte e não possui campo validável.');
      const current = finding.indicator.values[0] || null;
      if (current) await tx.indicatorValue.update({ where: { id: current.id }, data: { isCurrent: false, validationState: 'SUPERSEDED' } });
      const data = { indicatorId: finding.indicatorId, isCurrent: true, validationState: 'VALIDATED', numeratorRaw: current?.numeratorRaw, numeratorNumber: current?.numeratorNumber, numeratorYear: current?.numeratorYear, numeratorSource: current?.numeratorSource, numeratorSourceUrl: current?.numeratorSourceUrl, denominatorRaw: current?.denominatorRaw, denominatorNumber: current?.denominatorNumber, denominatorYear: current?.denominatorYear, denominatorSource: current?.denominatorSource, denominatorSourceUrl: current?.denominatorSourceUrl, finalRaw: current?.finalRaw, finalNumber: current?.finalNumber, finalFormula: current?.finalFormula, numeratorFormula: current?.numeratorFormula, denominatorFormula: current?.denominatorFormula, sourceLabel: `Validado a partir da descoberta ${finding.id}`, validatedAt: new Date(), validatedBy: reviewer };
      if (finding.targetField === 'NUMERATOR') { data.numeratorRaw = finding.candidateValueRaw; data.numeratorNumber = finding.candidateValueNumber; data.numeratorYear = finding.referenceYear; data.numeratorSource = finding.sourceName; data.numeratorSourceUrl = finding.sourceUrl; data.finalRaw = null; data.finalNumber = null; }
      else if (finding.targetField === 'DENOMINATOR') { data.denominatorRaw = finding.candidateValueRaw; data.denominatorNumber = finding.candidateValueNumber; data.denominatorYear = finding.referenceYear; data.denominatorSource = finding.sourceName; data.denominatorSourceUrl = finding.sourceUrl; data.finalRaw = null; data.finalNumber = null; }
      else if (finding.targetField === 'FINAL') { data.finalRaw = finding.candidateValueRaw; data.finalNumber = finding.candidateValueNumber; }
      else if (finding.targetField === 'UPDATE' && finding.candidateValueRaw) { data.finalRaw = finding.candidateValueRaw; data.finalNumber = finding.candidateValueNumber; }
      const newValue = await tx.indicatorValue.create({ data });
      if (finding.sourceUrl || finding.evidenceExcerpt) await tx.evidence.create({ data: { indicatorId: finding.indicatorId, valueId: newValue.id, findingId: finding.id, title: finding.sourceName, organization: finding.sourceOrganization, url: finding.sourceUrl, documentName: finding.evidenceDocument, page: finding.evidencePage, excerpt: finding.evidenceExcerpt, accessedAt: new Date() } });
      const hasN = Boolean(data.numeratorRaw || data.numeratorNumber !== null && data.numeratorNumber !== undefined);
      const hasD = Boolean(data.denominatorRaw || data.denominatorNumber !== null && data.denominatorNumber !== undefined);
      const hasF = Boolean(data.finalRaw || data.finalNumber !== null && data.finalNumber !== undefined);
      const indicatorStatus = hasF || (hasN && hasD) ? 'VALIDATED' : 'PARTIAL';
      await tx.indicator.update({ where: { id: finding.indicatorId }, data: { status: indicatorStatus } });
      await tx.agentFinding.update({ where: { id: finding.id }, data: { status: 'VALIDATED', reviewedAt: new Date(), reviewedBy: reviewer } });
      await tx.indicatorHistory.create({ data: { indicatorId: finding.indicatorId, action: 'FINDING_VALIDATED', actor: reviewer, details: { findingId: finding.id, newValueId: newValue.id, targetField: finding.targetField } } });
      return { findingId: finding.id, newValueId: newValue.id, status: indicatorStatus };
    });
    res.json(result);
  } catch (error) { next(error); }
});
