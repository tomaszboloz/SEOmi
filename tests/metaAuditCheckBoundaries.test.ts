import { describe, expect, it } from 'vitest';
import type { IndexabilityAssessment, MetaTags } from '@/types';
import { buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import { createAuditFixture } from './fixtures/audit';

const checks = (meta: Partial<MetaTags> = {}, indexability?: IndexabilityAssessment) => {
  const audit = createAuditFixture();
  audit.meta_tags = { ...audit.meta_tags, ...meta };
  audit.indexability = indexability;
  const result = buildMetaAndIndexabilityChecks(audit);
  expect(result).toHaveLength(22);
  expect(new Set(result.map((check) => check.id)).size).toBe(22);
  expect(result.every((check) => check.label && check.category && check.evidence)).toBe(true);
  return Object.fromEntries(result.map((check) => [check.id, check.status]));
};

describe('metadata audit boundaries', () => {
  it('distinguishes missing, whitespace, trimmed and equal title/description', () => {
    expect(checks({ title: undefined, description: undefined })).toMatchObject({ title: 'error', description: 'error', 'title-length-min': 'not_applicable', 'title-length-max': 'not_applicable', 'title-trimmed': 'pass', 'description-length-min': 'not_applicable', 'description-length-max': 'not_applicable', 'title-description-distinct': 'not_applicable' });
    expect(checks({ title: ' ', description: ' ' })).toMatchObject({ title: 'error', description: 'error', 'title-trimmed': 'warning' });
    expect(checks({ title: ' Coffee ', description: 'coffee' })).toMatchObject({ title: 'pass', description: 'pass', 'title-trimmed': 'warning', 'title-description-distinct': 'warning' });
    expect(checks({ title: 'Coffee', description: 'Different' })).toMatchObject({ 'title-trimmed': 'pass', 'title-description-distinct': 'pass' });
  });
  it.each([[19, 69, 'warning', 'pass', 'warning', 'pass'], [20, 70, 'pass', 'pass', 'pass', 'pass'], [60, 160, 'pass', 'pass', 'pass', 'pass'], [61, 161, 'pass', 'warning', 'pass', 'warning']])('checks declared character lengths at %i/%i', (title_length, description_length, titleMin, titleMax, descriptionMin, descriptionMax) => {
    const result = checks({ title: 'Title', description: 'Description', title_length: Number(title_length), description_length: Number(description_length) });
    expect(result['title-length-min']).toBe(titleMin);
    expect(result['title-length-max']).toBe(titleMax);
    expect(result['description-length-min']).toBe(descriptionMin);
    expect(result['description-length-max']).toBe(descriptionMax);
  });
  it('handles absent, fixed-width, responsive and scaling-locked viewports', () => {
    expect(checks({ viewport: '' })).toMatchObject({ viewport: 'error', 'viewport-responsive': 'not_applicable', 'viewport-no-scale-lock': 'not_applicable' });
    expect(checks({ viewport: 'width=1024' })).toMatchObject({ viewport: 'warning', 'viewport-responsive': 'warning', 'viewport-no-scale-lock': 'pass' });
    expect(checks({ viewport: 'width=device-width, initial-scale=1' })).toMatchObject({ viewport: 'pass', 'viewport-responsive': 'pass', 'viewport-no-scale-lock': 'pass' });
    for (const viewport of ['width=device-width,user-scalable=no', 'width=device-width;maximum-scale=1.0']) {
      expect(checks({ viewport })['viewport-no-scale-lock']).toBe('warning');
    }
  });
  it('distinguishes canonical schemes and optional metadata without inventing data', () => {
    expect(checks({ canonical: undefined })).toMatchObject({ canonical: 'warning', 'canonical-absolute': 'not_applicable', 'canonical-https': 'not_applicable', charset: 'not_applicable', author: 'not_applicable', generator: 'pass', 'robots-present': 'not_applicable', 'robots-indexable': 'not_applicable' });
    expect(checks({ canonical: '/page', charset: 'iso-8859-1', author: 'Author', generator: 'Generator' })).toMatchObject({ canonical: 'pass', 'canonical-absolute': 'warning', 'canonical-https': 'warning', charset: 'warning', author: 'pass', generator: 'warning' });
    expect(checks({ canonical: 'http://example.test', charset: 'UTF-8' })).toMatchObject({ 'canonical-absolute': 'pass', 'canonical-https': 'warning', charset: 'pass' });
    expect(checks({ canonical: 'https://example.test' })['canonical-https']).toBe('pass');
  });
  it('retains missing indexability evidence instead of inferring a verdict', () => {
    expect(checks()).toMatchObject({ indexability: 'not_applicable', 'indexability-canonical-match': 'not_applicable', 'canonical-target-status': 'not_applicable' });
    expect(checks({}, { status: 'uncertain', reasons: [] })).toMatchObject({ indexability: 'warning', 'indexability-canonical-match': 'not_applicable', 'canonical-target-status': 'not_applicable' });
    expect(checks({}, { status: 'blocked', reasons: ['Reason'], canonical_matches_final_url: false })).toMatchObject({ indexability: 'error', 'indexability-canonical-match': 'warning' });
    expect(checks({}, { status: 'indexable', reasons: [], canonical_matches_final_url: true })).toMatchObject({ indexability: 'pass', 'indexability-canonical-match': 'pass' });
  });
  it.each([[undefined, 'error'], [0, 'error'], [199, 'error'], [200, 'pass'], [399, 'pass'], [400, 'error']] as const)('checks observed canonical target status %s', (canonical_target_status, expected) => {
    expect(checks({}, { status: 'uncertain', reasons: [], canonical_target_checked: true, canonical_target_status })['canonical-target-status']).toBe(expected);
  });
});
