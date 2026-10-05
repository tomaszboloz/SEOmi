import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildAccessibilityChecks } from '@/services/auditChecks/accessibilityAndContentChecks';
import type { PageAuditData } from '@/types';

const good = { document_language: 'en', landmarks: [{ name: 'main', count: 1 }, { name: 'nav', count: 2 }], aria_attribute_count: 3, form_control_count: 2, unlabeled_form_control_count: 0, findings: [], manual_review_items: [] };
const run = (accessibility?: Record<string, unknown>) => buildAccessibilityChecks({ accessibility } as unknown as PageAuditData);
const statuses = (accessibility?: Record<string, unknown>) => Object.fromEntries(run(accessibility).map((c) => [c.id, c.status]));

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('accessibility checks', () => {
  it('marks everything not applicable without a report', () => {
    expect(new Set(Object.values(statuses(undefined)))).toEqual(new Set(['not_applicable']));
  });

  it('passes a complete report', () => {
    expect(new Set(Object.values(statuses(good)))).toEqual(new Set(['pass']));
  });

  it('warns on a missing language and recomputes the basics summary', () => {
    const s = statuses({ ...good, document_language: '' });
    expect([s['accessibility-language'], s['accessibility-basics']]).toEqual(['warning', 'warning']);
  });

  it('warns on unlabeled controls', () => {
    const s = statuses({ ...good, unlabeled_form_control_count: 2 });
    expect([s['accessibility-labels'], s['accessibility-basics']]).toEqual(['warning', 'warning']);
  });

  it.each([[[], 'warning'], [[{ name: 'MAIN', count: 1 }], 'pass'], [[{ name: 'main', count: 2 }], 'warning'], [[{ name: 'nav', count: 1 }], 'warning']])('rates landmarks %j main as %s', (landmarks, expected) => {
    expect(statuses({ ...good, landmarks })['accessibility-main']).toBe(expected);
  });

  it('rates the landmark total', () => {
    expect(statuses({ ...good, landmarks: [] })['accessibility-landmarks']).toBe('warning');
    expect(statuses({ ...good, landmarks: [{ name: 'x', count: 1 }] })['accessibility-landmarks']).toBe('pass');
  });

  it('errors on non-finite counters', () => {
    const s = statuses({ ...good, aria_attribute_count: NaN, form_control_count: Infinity });
    expect([s['accessibility-aria-count'], s['accessibility-form-controls']]).toEqual(['error', 'error']);
  });

  it('requires evidence and recommendation on every finding', () => {
    const ok = { evidence: 'e', recommendation: 'r' };
    expect(statuses({ ...good, findings: [ok] })['accessibility-evidence']).toBe('pass');
    expect(statuses({ ...good, findings: [ok, { evidence: 'e' }] })['accessibility-evidence']).toBe('warning');
    expect(statuses({ ...good, findings: undefined })['accessibility-evidence']).toBe('pass');
  });

  it('reports hidden and honeypot counts, defaulting absent counters to zero', () => {
    const checks = run({ ...good, hidden_form_control_count: 4, anti_spam_text_control_count: 1, manual_review_items: ['a', 'b'] });
    expect(checks.find((c) => c.id === 'accessibility-hidden-controls')?.evidence).toContain('4');
    expect(checks.find((c) => c.id === 'accessibility-honeypot')?.evidence).toContain('1');
    expect(checks.find((c) => c.id === 'accessibility-manual-review')?.evidence).toContain('2');
    expect(run(good).find((c) => c.id === 'accessibility-hidden-controls')?.evidence).toContain('0');
  });
});
