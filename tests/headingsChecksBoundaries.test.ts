import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildHeadingsChecks } from '@/services/auditChecks/socialAndHeadingsChecks';
import type { PageAuditData } from '@/types';

type Node = { level: number; text: string };
const page = (h: Record<string, unknown>) => ({ headings: { h1_count: 1, h1_texts: ['Main'], has_valid_hierarchy: true, issues: [], hierarchy: [{ level: 1, text: 'Main' }, { level: 2, text: 'Sub' }], ...h } }) as unknown as PageAuditData;
const statuses = (h: Record<string, unknown>) => Object.fromEntries(buildHeadingsChecks(page(h)).map((c) => [c.id, c.status]));

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('heading checks', () => {
  it('passes a clean outline', () => {
    expect(Object.values(statuses({})).every((s) => s === 'pass')).toBe(true);
  });

  it.each([[0, 'error'], [1, 'pass'], [2, 'warning']])('rates %i H1 headings as %s', (count, expected) => {
    expect(statuses({ h1_count: count })['h1']).toBe(expected);
  });

  it('errors on a missing or blank H1 text', () => {
    expect(statuses({ h1_texts: [] })['h1-nonempty']).toBe('error');
    expect(statuses({ h1_texts: ['  '] })['h1-nonempty']).toBe('error');
  });

  it('reports hierarchy problems with their issue text', () => {
    const checks = buildHeadingsChecks(page({ has_valid_hierarchy: false, issues: ['H2 → H4'] }));
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(byId['heading-hierarchy'].status).toBe('warning');
    expect(byId['heading-issues'].status).toBe('warning');
    expect(byId['heading-issues'].evidence).toContain('H2 → H4');
  });

  it('skips level and coverage checks on an empty outline', () => {
    const s = statuses({ hierarchy: [], h1_count: 0, h1_texts: [] });
    expect(s['heading-first-level']).toBe('not_applicable');
    expect(s['heading-text-coverage']).toBe('not_applicable');
    expect(s['heading-nonempty-all']).toBe('pass');
  });

  it('warns when the first heading is not an H1 and when texts are blank', () => {
    const hierarchy: Node[] = [{ level: 2, text: 'A' }, { level: 3, text: '   ' }];
    const s = statuses({ hierarchy });
    expect([s['heading-first-level'], s['heading-nonempty-all'], s['heading-text-coverage']]).toEqual(['warning', 'warning', 'warning']);
  });

  it('errors on out-of-range levels and warns on duplicate H1 texts', () => {
    expect(statuses({ hierarchy: [{ level: 0, text: 'x' }] })['heading-depth']).toBe('error');
    expect(statuses({ hierarchy: [{ level: 7, text: 'x' }] })['heading-depth']).toBe('error');
    expect(statuses({ h1_texts: ['A', 'A'] })['heading-unique-h1']).toBe('warning');
  });
});
