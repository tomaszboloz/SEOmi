import { describe, expect, it } from 'vitest';
import { buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import i18n from '@/i18n';
import { audit } from './fixtures/auditChecksContracts';

const getCheck = (checks: ReturnType<typeof buildMetaAndIndexabilityChecks>, id: string) => checks.find((c) => c.id === id);

describe('buildMetaAndIndexabilityChecks - title and description boundaries and distinctness', () => {
  it('flags missing or whitespace-only title and description as errors', () => {
    const checks = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, title: '   ', title_length: 0, description: '   ', description_length: 0 },
    }));
    expect(getCheck(checks, 'title')).toMatchObject({ status: 'error', evidence: i18n.t('auditChecks.evidence.missingTitle') });
    expect(getCheck(checks, 'description')).toMatchObject({ status: 'error', evidence: i18n.t('auditChecks.evidence.missingDescription') });
    expect(getCheck(checks, 'title-length-min')?.status).toBe('not_applicable');
    expect(getCheck(checks, 'title-length-max')?.status).toBe('not_applicable');
    expect(getCheck(checks, 'description-length-min')?.status).toBe('not_applicable');
    expect(getCheck(checks, 'description-length-max')?.status).toBe('not_applicable');
    expect(getCheck(checks, 'title-description-distinct')?.status).toBe('not_applicable');
  });

  it('warns when title contains leading or trailing whitespace', () => {
    const untrimmed = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, title: '  Untrimmed Title Text  ', title_length: 24 },
    }));
    expect(getCheck(untrimmed, 'title-trimmed')).toMatchObject({
      status: 'warning',
      evidence: i18n.t('auditChecks.evidence.savedCharacters', { count: 24 }),
    });

    const clean = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, title: 'Clean Title Text', title_length: 16 },
    }));
    expect(getCheck(clean, 'title-trimmed')?.status).toBe('pass');
  });

  it('warns when title and description are identical, including case-insensitive match', () => {
    const identical = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, title: 'Audit Platform for SEO', description: 'audit platform for seo' },
    }));
    expect(getCheck(identical, 'title-description-distinct')).toMatchObject({
      status: 'warning',
      evidence: i18n.t('auditChecks.evidence.identicalValues'),
    });

    const distinct = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, title: 'Audit Platform for SEO', description: 'Comprehensive website analysis and diagnostic report.' },
    }));
    expect(getCheck(distinct, 'title-description-distinct')).toMatchObject({
      status: 'pass',
      evidence: i18n.t('auditChecks.evidence.differentValues'),
    });
  });

  it.each([
    [19, 'warning', 'pass'],
    [20, 'pass', 'pass'],
    [60, 'pass', 'pass'],
    [61, 'pass', 'warning'],
  ] as const)('evaluates title length boundary %i accurately', (len, minStatus, maxStatus) => {
    const checks = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, title: 'X'.repeat(len), title_length: len },
    }));
    expect(getCheck(checks, 'title-length-min')?.status).toBe(minStatus);
    expect(getCheck(checks, 'title-length-max')?.status).toBe(maxStatus);
  });

  it.each([
    [69, 'warning', 'pass'],
    [70, 'pass', 'pass'],
    [160, 'pass', 'pass'],
    [161, 'pass', 'warning'],
  ] as const)('evaluates description length boundary %i accurately', (len, minStatus, maxStatus) => {
    const checks = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, description: 'D'.repeat(len), description_length: len },
    }));
    expect(getCheck(checks, 'description-length-min')?.status).toBe(minStatus);
    expect(getCheck(checks, 'description-length-max')?.status).toBe(maxStatus);
  });
});

describe('buildMetaAndIndexabilityChecks - viewport, charset and technical meta edge cases', () => {
  it('detects missing viewport and mobile scale locks', () => {
    const missing = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, viewport: undefined },
    }));
    expect(getCheck(missing, 'viewport')).toMatchObject({ status: 'error', evidence: i18n.t('auditChecks.evidence.missingViewport') });
    expect(getCheck(missing, 'viewport-responsive')?.status).toBe('not_applicable');
    expect(getCheck(missing, 'viewport-no-scale-lock')?.status).toBe('not_applicable');

    for (const locked of ['width=device-width, user-scalable=no', 'width=device-width, maximum-scale=1', 'width=device-width, maximum-scale=1.0']) {
      const checks = buildMetaAndIndexabilityChecks(audit({ meta_tags: { ...audit().meta_tags, viewport: locked } }));
      expect(getCheck(checks, 'viewport-no-scale-lock')?.status).toBe('warning');
    }

    const unlocked = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, viewport: 'width=device-width, initial-scale=1.0, maximum-scale=3.0' },
    }));
    expect(getCheck(unlocked, 'viewport-no-scale-lock')?.status).toBe('pass');
  });

  it('validates charset, author presence and warns on generator disclosure', () => {
    for (const cs of ['utf-8', 'UTF-8', 'utf8']) {
      const checks = buildMetaAndIndexabilityChecks(audit({ meta_tags: { ...audit().meta_tags, charset: cs } }));
      expect(getCheck(checks, 'charset')?.status).toBe('pass');
    }
    const legacyCs = buildMetaAndIndexabilityChecks(audit({ meta_tags: { ...audit().meta_tags, charset: 'iso-8859-2' } }));
    expect(getCheck(legacyCs, 'charset')?.status).toBe('warning');

    const authored = buildMetaAndIndexabilityChecks(audit({ meta_tags: { ...audit().meta_tags, author: 'SEO Auditor' } }));
    expect(getCheck(authored, 'author')?.status).toBe('pass');
    const noAuthor = buildMetaAndIndexabilityChecks(audit({ meta_tags: { ...audit().meta_tags, author: undefined } }));
    expect(getCheck(noAuthor, 'author')?.status).toBe('not_applicable');

    const disclosed = buildMetaAndIndexabilityChecks(audit({ meta_tags: { ...audit().meta_tags, generator: 'WordPress 6.4' } }));
    expect(getCheck(disclosed, 'generator')).toMatchObject({ status: 'warning', evidence: 'WordPress 6.4' });

    const hidden = buildMetaAndIndexabilityChecks(audit({ meta_tags: { ...audit().meta_tags, generator: undefined } }));
    expect(getCheck(hidden, 'generator')).toMatchObject({ status: 'pass', evidence: i18n.t('auditChecks.evidence.noGenerator') });
  });

  it('positive normal control satisfies all 22 meta and indexability checks', () => {
    const normal = buildMetaAndIndexabilityChecks(audit({
      meta_tags: {
        ...audit().meta_tags,
        title: 'Najlepsze narzędzia SEO dla programistów 2026', title_length: 46,
        description: 'Poznaj polecane lokalne narzędzia do audytu technicznego SEO i popraw widoczność swojej witryny.', description_length: 97,
        viewport: 'width=device-width, initial-scale=1.0', canonical: 'https://example.com/tools',
        robots: 'index, follow', charset: 'utf-8', author: 'Kamil Biegacz', generator: undefined,
      },
      indexability: {
        status: 'indexable', reasons: [], canonical_matches_final_url: true, canonical_target_checked: true, canonical_target_status: 200,
      },
    }));

    expect(normal).toHaveLength(22);
    expect(normal.every((c) => c.status === 'pass')).toBe(true);
    expect(normal.some((c) => c.status === 'error' || c.status === 'warning')).toBe(false);
  });
});
