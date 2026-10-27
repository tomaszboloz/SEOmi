import { describe, expect, it } from 'vitest';
import { buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import { buildTechnicalChecks } from '@/services/auditChecks/securityAndTechnicalChecks';
import i18n from '@/i18n';
import { audit } from './fixtures/auditChecksContracts';

const getCheck = (checks: ReturnType<typeof buildMetaAndIndexabilityChecks>, id: string) => checks.find((c) => c.id === id);

describe('buildMetaAndIndexabilityChecks - robots directives and indexability regressions', () => {
  it('classifies any noindex or none directive as an error, never a pass', () => {
    for (const directive of ['noindex', 'none', 'NOINDEX, NOFOLLOW', 'none, noarchive', 'all, none']) {
      const checks = buildMetaAndIndexabilityChecks(audit({
        meta_tags: { ...audit().meta_tags, robots: directive },
      }));
      expect(getCheck(checks, 'robots-present')?.status).toBe('pass');
      expect(getCheck(checks, 'robots-indexable')?.status).toBe('error');
      expect(getCheck(checks, 'robots-indexable')?.evidence).toBe(directive);
    }
  });

  it('classifies permissive robots directives as pass', () => {
    for (const directive of ['index, follow', 'all', 'max-snippet:-1']) {
      const checks = buildMetaAndIndexabilityChecks(audit({
        meta_tags: { ...audit().meta_tags, robots: directive },
      }));
      expect(getCheck(checks, 'robots-indexable')?.status).toBe('pass');
    }
  });

  it('handles absent robots directive as not_applicable instead of pass', () => {
    const checks = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, robots: undefined },
    }));
    expect(getCheck(checks, 'robots-present')).toMatchObject({
      status: 'not_applicable', evidence: i18n.t('auditChecks.evidence.missingRobots'),
    });
    expect(getCheck(checks, 'robots-indexable')).toMatchObject({
      status: 'not_applicable', evidence: i18n.t('auditChecks.evidence.missingDirective'),
    });
  });

  it('ensures blocked and uncertain indexability verdicts never yield pass', () => {
    const blocked = buildMetaAndIndexabilityChecks(audit({
      indexability: { status: 'blocked', reasons: ['Disallowed by robots.txt'] },
    }));
    expect(getCheck(blocked, 'indexability')).toMatchObject({
      status: 'error', evidence: 'blocked · Disallowed by robots.txt',
    });

    const uncertain = buildMetaAndIndexabilityChecks(audit({
      indexability: { status: 'uncertain', reasons: ['Dynamic headers observed'] },
    }));
    expect(getCheck(uncertain, 'indexability')).toMatchObject({
      status: 'warning', evidence: 'uncertain · Dynamic headers observed',
    });

    const absent = buildMetaAndIndexabilityChecks(audit({ indexability: undefined }));
    expect(getCheck(absent, 'indexability')).toMatchObject({
      status: 'not_applicable', evidence: i18n.t('auditChecks.evidence.missingVerdict'),
    });
  });
});

describe('buildMetaAndIndexabilityChecks - canonical absence and target status regressions', () => {
  it('treats canonical absence as warning on presence and not_applicable on protocol', () => {
    const checks = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, canonical: undefined },
    }));
    expect(getCheck(checks, 'canonical')).toMatchObject({
      status: 'warning', evidence: i18n.t('auditChecks.evidence.missingCanonical'),
    });
    expect(getCheck(checks, 'canonical-absolute')?.status).toBe('not_applicable');
    expect(getCheck(checks, 'canonical-https')?.status).toBe('not_applicable');
  });

  it('rejects relative, HTTP and non-HTTP canonicals from absolute/HTTPS passes', () => {
    const relative = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, canonical: '/rel-canonical' },
    }));
    expect(getCheck(relative, 'canonical')?.status).toBe('pass');
    expect(getCheck(relative, 'canonical-absolute')?.status).toBe('warning');
    expect(getCheck(relative, 'canonical-https')?.status).toBe('warning');

    const http = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, canonical: 'http://example.com/canonical' },
    }));
    expect(getCheck(http, 'canonical-absolute')?.status).toBe('pass');
    expect(getCheck(http, 'canonical-https')?.status).toBe('warning');

    const ftp = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, canonical: 'ftp://example.com/canonical' },
    }));
    expect(getCheck(ftp, 'canonical-absolute')?.status).toBe('warning');
    expect(getCheck(ftp, 'canonical-https')?.status).toBe('warning');
  });

  it('reports canonical target check failure and unreachable target as errors', () => {
    const timeout = buildMetaAndIndexabilityChecks(audit({
      indexability: { status: 'indexable', reasons: [], canonical_target_checked: true, canonical_target_status: 0 },
    }));
    expect(getCheck(timeout, 'canonical-target-status')?.status).toBe('error');

    const notFound = buildMetaAndIndexabilityChecks(audit({
      indexability: { status: 'indexable', reasons: [], canonical_target_checked: true, canonical_target_status: 404 },
    }));
    expect(getCheck(notFound, 'canonical-target-status')?.status).toBe('error');

    const unchecked = buildMetaAndIndexabilityChecks(audit({
      indexability: { status: 'indexable', reasons: [], canonical_target_checked: false },
    }));
    expect(getCheck(unchecked, 'canonical-target-status')).toMatchObject({
      status: 'not_applicable', evidence: i18n.t('auditChecks.evidence.targetNotChecked'),
    });
  });
});

describe('technical-robots-url and indexability normal control', () => {
  it('checks robots.txt url presence and absence in technical checks', () => {
    const missing = buildTechnicalChecks(audit({ technical: { hreflang_tags: [], robots_txt_url: undefined } }));
    expect(missing.find((c) => c.id === 'technical-robots-url')).toMatchObject({
      status: 'not_applicable', evidence: i18n.t('auditChecks.evidence.robotsUrlMissing'),
    });

    const present = buildTechnicalChecks(audit({ technical: { hreflang_tags: [], robots_txt_url: 'https://example.com/robots.txt' } }));
    expect(present.find((c) => c.id === 'technical-robots-url')).toMatchObject({
      status: 'pass', evidence: 'https://example.com/robots.txt',
    });
  });

  it('positive normal control passes all 8 robots, canonical and indexability checks', () => {
    const normal = buildMetaAndIndexabilityChecks(audit({
      meta_tags: { ...audit().meta_tags, canonical: 'https://example.com', robots: 'index, follow' },
      indexability: { status: 'indexable', reasons: [], canonical_matches_final_url: true, canonical_target_checked: true, canonical_target_status: 200 },
    }));
    const ids = ['canonical', 'canonical-absolute', 'canonical-https', 'robots-present', 'robots-indexable', 'indexability', 'indexability-canonical-match', 'canonical-target-status'];
    for (const id of ids) {
      expect(getCheck(normal, id)?.status, id).toBe('pass');
    }
  });
});
