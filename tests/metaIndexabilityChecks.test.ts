import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import type { PageAuditData } from '@/types';

const baseMeta = { title: 'A sufficiently long page title', title_length: 30, description: 'd'.repeat(100), description_length: 100, viewport: 'width=device-width, initial-scale=1', canonical: 'https://a.test/', robots: '', charset: 'utf-8', author: '', generator: '' };
const page = (meta: Record<string, unknown> = {}, indexability?: Record<string, unknown>) =>
  ({ url: 'https://a.test/', final_url: 'https://a.test/', meta_tags: { ...baseMeta, ...meta }, indexability }) as unknown as PageAuditData;
const status = (audit: PageAuditData, id: string) => buildMetaAndIndexabilityChecks(audit).find((entry) => entry.id === id)?.status;

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('viewport', () => {
  it.each([
    ['', 'error', 'not_applicable', 'not_applicable'],
    ['width=device-width', 'pass', 'pass', 'pass'],
    ['WIDTH = device-width ; initial-scale=1', 'pass', 'pass', 'pass'],
    ['width=1024', 'warning', 'warning', 'pass'],
    ['width=device-width, user-scalable=no', 'pass', 'pass', 'warning'],
    ['width=device-width, maximum-scale=1.0', 'pass', 'pass', 'warning'],
    ['width=device-width, maximum-scale=5', 'pass', 'pass', 'pass'],
  ])('rates viewport "%s"', (viewport, base, responsive, scaleLock) => {
    const audit = page({ viewport });
    expect([status(audit, 'viewport'), status(audit, 'viewport-responsive'), status(audit, 'viewport-no-scale-lock')]).toEqual([base, responsive, scaleLock]);
  });
});

describe('canonical, robots and charset', () => {
  it('rates canonical presence, absoluteness and HTTPS', () => {
    expect(status(page({ canonical: '' }), 'canonical')).toBe('warning');
    expect(status(page({ canonical: '' }), 'canonical-absolute')).toBe('not_applicable');
    expect(status(page({ canonical: '/relative' }), 'canonical-absolute')).toBe('warning');
    expect(status(page({ canonical: 'http://a.test/' }), 'canonical-https')).toBe('warning');
    expect(status(page(), 'canonical-https')).toBe('pass');
  });

  it.each([
    ['', 'not_applicable', 'not_applicable'],
    ['index, follow', 'pass', 'pass'],
    ['noindex', 'pass', 'error'],
    ['NONE', 'pass', 'error'],
    ['index, noarchive', 'pass', 'pass'],
    ['nosnippet', 'pass', 'pass'],
  ])('rates robots "%s"', (robots, present, indexable) => {
    const audit = page({ robots });
    expect(status(audit, 'robots-present')).toBe(robots ? present : 'not_applicable');
    expect(status(audit, 'robots-indexable')).toBe(indexable);
  });

  it('accepts UTF-8 spellings, warns for other charsets and skips a missing one', () => {
    expect(status(page({ charset: 'UTF8' }), 'charset')).toBe('pass');
    expect(status(page({ charset: 'iso-8859-2' }), 'charset')).toBe('warning');
    expect(status(page({ charset: '' }), 'charset')).toBe('not_applicable');
  });

  it('treats author as informational and a generator as a disclosure warning', () => {
    expect(status(page({ author: 'Ann' }), 'author')).toBe('pass');
    expect(status(page(), 'author')).toBe('not_applicable');
    expect(status(page({ generator: 'WordPress 6' }), 'generator')).toBe('warning');
    expect(status(page(), 'generator')).toBe('pass');
  });
});

describe('indexability verdict', () => {
  it('is not applicable without a verdict', () => {
    for (const id of ['indexability', 'indexability-canonical-match', 'canonical-target-status']) expect(status(page(), id)).toBe('not_applicable');
  });

  it.each([['indexable', 'pass'], ['blocked', 'error'], ['unknown', 'warning']])('maps verdict %s to %s and lists reasons', (verdict, expected) => {
    const audit = page({}, { status: verdict, reasons: ['noindex', 'robots'] });
    expect(status(audit, 'indexability')).toBe(expected);
    expect(buildMetaAndIndexabilityChecks(audit).find((entry) => entry.id === 'indexability')?.evidence).toBe(`${verdict} · noindex robots`);
  });

  it('compares canonical and final URL only when the provider knows the answer', () => {
    const verdict = (match: boolean | null | undefined) => page({}, { status: 'indexable', reasons: [], canonical_matches_final_url: match });
    expect(status(verdict(true), 'indexability-canonical-match')).toBe('pass');
    expect(status(verdict(false), 'indexability-canonical-match')).toBe('warning');
    expect(status(verdict(null), 'indexability-canonical-match')).toBe('not_applicable');
    expect(status(verdict(undefined), 'indexability-canonical-match')).toBe('not_applicable');
  });

  it('checks the canonical target status only when it was fetched', () => {
    const target = (checked: boolean, code?: number) => page({}, { status: 'indexable', reasons: [], canonical_target_checked: checked, canonical_target_status: code });
    expect(status(target(false), 'canonical-target-status')).toBe('not_applicable');
    expect(status(target(true, 200), 'canonical-target-status')).toBe('pass');
    expect(status(target(true, 399), 'canonical-target-status')).toBe('pass');
    expect(status(target(true, 404), 'canonical-target-status')).toBe('error');
    expect(status(target(true), 'canonical-target-status')).toBe('error');
  });
});
