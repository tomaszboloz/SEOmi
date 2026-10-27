import type { OutreachTarget } from './gap';

/** Quotes a cell and neutralizes spreadsheet formulas (a leading = + - @ would execute). */
const cell = (value: string | number): string => {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const targetsToCsv = (targets: OutreachTarget[]): string =>
  [
    ['domain', 'priority', 'relevance', 'authority', 'linking_competitors'],
    ...targets.map((t) => [t.domain, t.priority.toFixed(3), t.relevance.toFixed(2), t.authority.toFixed(2), t.linkingCompetitors.join(' | ')]),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\n');
