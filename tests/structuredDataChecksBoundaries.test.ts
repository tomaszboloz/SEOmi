import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildStructuredDataChecks } from '@/services/auditChecks/securityAndTechnicalChecks';
import type { PageAuditData } from '@/types';

const item = (extra: Record<string, unknown> = {}) => ({ format: 'JSON-LD', data_type: 'Article', content: { '@type': 'Article' }, validation_issues: [], ...extra });
const statuses = (structured?: unknown[]) => Object.fromEntries(buildStructuredDataChecks({ structured_data: structured } as unknown as PageAuditData).map((c) => [c.id, c.status]));

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('structured data checks', () => {
  it('treats missing and empty data as a warning with dependent checks not applicable', () => {
    for (const input of [undefined, []]) {
      const s = statuses(input);
      expect(s['structured-present']).toBe('warning');
      for (const id of ['structured-errors', 'structured-warnings', 'structured-type-coverage', 'structured-unique-types', 'structured-jsonld-valid']) expect(s[id]).toBe('not_applicable');
    }
  });

  it('passes a single valid JSON-LD block', () => {
    expect(Object.values(statuses([item()])).every((s) => s === 'pass')).toBe(true);
  });

  it('counts errors and warnings separately', () => {
    const issues = [{ severity: 'error', path: 'a' }, { severity: 'warning', message: 'm' }];
    const s = statuses([item({ validation_issues: issues })]);
    expect([s['structured-errors'], s['structured-warnings']]).toEqual(['error', 'warning']);
  });

  it('tolerates items without an issues list', () => {
    expect(statuses([item({ validation_issues: undefined })])['structured-errors']).toBe('pass');
  });

  it('warns on unknown formats, untyped and duplicate types', () => {
    const s = statuses([item({ format: 'Other', data_type: '' }), item({ data_type: '' })]);
    expect([s['structured-format-coverage'], s['structured-type-coverage'], s['structured-unique-types']]).toEqual(['warning', 'warning', 'warning']);
  });

  it('flags JSON-LD without an object body but ignores other formats', () => {
    expect(statuses([item({ content: null })])['structured-jsonld-valid']).toBe('warning');
    expect(statuses([item({ content: 'text' })])['structured-jsonld-valid']).toBe('warning');
    expect(statuses([item({ format: 'Microdata', content: null })])['structured-jsonld-valid']).toBe('not_applicable');
  });

  it('warns when a finding has neither path nor message', () => {
    expect(statuses([item({ validation_issues: [{ severity: 'info' }] })])['structured-finding-paths']).toBe('warning');
  });
});
