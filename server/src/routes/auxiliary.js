import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const auxiliaryRouter = Router();

function normalizeComponent(value = '') {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.;:]$/, '');
}
function hasValue(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

auxiliaryRouter.get('/', async (req, res, next) => {
  try {
    const { q = '', role = '', standard = '' } = req.query;
    const indicators = await prisma.indicator.findMany({
      where: standard ? { standard: { code: String(standard) } } : {},
      include: {
        standard: true,
        values: { where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: [{ standard: { code: 'asc' } }, { sourceRow: 'asc' }],
    });

    const map = new Map();
    const add = (indicator, componentRole, description, value) => {
      if (!description || !String(description).trim()) return;
      const key = normalizeComponent(description);
      if (!key) return;
      if (!map.has(key)) map.set(key, {
        id: key,
        name: String(description).trim(),
        roles: new Set(),
        uses: [],
        values: [],
      });
      const item = map.get(key);
      item.roles.add(componentRole);
      item.uses.push({
        indicatorId: indicator.id,
        standard: indicator.standard.code,
        code: indicator.code,
        name: indicator.name,
        role: componentRole,
      });

      const raw = componentRole === 'NUMERATOR' ? value?.numeratorRaw : value?.denominatorRaw;
      const numeric = componentRole === 'NUMERATOR' ? value?.numeratorNumber : value?.denominatorNumber;
      const year = componentRole === 'NUMERATOR' ? value?.numeratorYear : value?.denominatorYear;
      const source = componentRole === 'NUMERATOR' ? value?.numeratorSource : value?.denominatorSource;
      const sourceUrl = componentRole === 'NUMERATOR' ? value?.numeratorSourceUrl : value?.denominatorSourceUrl;
      if (hasValue(raw) || numeric !== null && numeric !== undefined) {
        const valueKey = [componentRole, raw ?? numeric, year || '', source || ''].join('|');
        if (!item.values.some((v) => v.key === valueKey)) item.values.push({
          key: valueKey,
          role: componentRole,
          raw: hasValue(raw) ? String(raw) : null,
          number: numeric ?? null,
          year: year || null,
          source: source || null,
          sourceUrl: sourceUrl || null,
          origin: value?.origin || null,
        });
      }
    };

    for (const indicator of indicators) {
      const value = indicator.values[0] || null;
      add(indicator, 'NUMERATOR', indicator.numeratorDescription, value);
      add(indicator, 'DENOMINATOR', indicator.denominatorDescription, value);
    }

    let items = [...map.values()].map((item) => ({
      ...item,
      roles: [...item.roles],
      uses: item.uses,
      values: item.values.map(({ key, ...v }) => v),
    }));

    const query = normalizeComponent(q);
    if (query) items = items.filter((i) =>
      normalizeComponent(i.name).includes(query)
      || i.uses.some((u) => normalizeComponent(`${u.standard} ${u.code} ${u.name}`).includes(query))
    );
    if (role) items = items.filter((i) => i.roles.includes(String(role).toUpperCase()));

    items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    res.json({
      total: items.length,
      source: 'Componentes únicos derivados dos numeradores e denominadores cadastrados nos indicadores ABNT.',
      items,
    });
  } catch (error) { next(error); }
});
