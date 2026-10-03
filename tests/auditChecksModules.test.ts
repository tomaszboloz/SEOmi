import { describe, it, expect } from 'vitest';
import { buildLocalAuditChecks } from '@/services/auditChecks';
import { buildHttpAndUrlChecks, buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import { buildOpenGraphChecks, buildTwitterCardChecks, buildHeadingsChecks } from '@/services/auditChecks/socialAndHeadingsChecks';
import { buildMediaChecks, buildLinksChecks } from '@/services/auditChecks/mediaAndLinksChecks';
import { buildSecurityChecks, buildStructuredDataChecks, buildTechnicalChecks } from '@/services/auditChecks/securityAndTechnicalChecks';
import { buildAccessibilityChecks, buildContentChecks, buildAmpAndTransportChecks } from '@/services/auditChecks/accessibilityAndContentChecks';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockAudit: any = {
  url: 'https://seomi.org',
  final_url: 'https://seomi.org',
  http_status: 200,
  response_time_ms: 120,
  redirect_chain: [],
  meta_tags: {
    title: 'SEOmi - Standalone SEO Auditor',
    title_length: 31,
    description: 'Local audit tool with high performance and zero telemetry.',
    description_length: 59,
    viewport: 'width=device-width, initial-scale=1',
    robots: 'index, follow',
    canonical: 'https://seomi.org',
  },
  open_graph: {
    og_title: 'SEOmi',
    og_description: 'Local audit tool',
    og_image: 'https://seomi.org/og.png',
    all_tags: [],
  },
  twitter_card: {
    twitter_card: 'summary_large_image',
    all_tags: [],
  },
  headings: {
    h1_count: 1,
    h1_texts: ['SEOmi Tool'],
    has_valid_hierarchy: true,
    hierarchy: [{ level: 1, text: 'SEOmi Tool' }],
    issues: [],
  },
  images: [
    { src: 'https://seomi.org/logo.webp', has_alt: true, alt: 'SEOmi Logo', width: 200, height: 50, format: 'webp' },
  ],
  links: {
    total_links: 1,
    internal_links: 1,
    external_links: 0,
    nofollow_links: 0,
    links: [{ href: 'https://seomi.org/about', text: 'About' }],
  },
  security_headers: { score: 85, strict_transport_security: 'max-age=31536000' },
  technical: { hreflang_tags: [] },
  content_stats: { word_count: 500, reading_time_minutes: 2, text_ratio_percent: 25, top_keywords: [{ term: 'seo', count: 10, density_percent: 2 }] },
  accessibility: { landmarks: [{ name: 'main', count: 1 }], unlabeled_form_control_count: 0, manual_review_items: [] },
  indexability: { status: 'indexable', reasons: [] },
  amp: { detected: false, amphtml_urls: [], findings: [], unchecked: [] },
  transport_security: { scheme: 'https', https: true, cookies: [], mixed_content_urls: [] },
};

describe('auditChecks modular architecture', () => {
  it('satisfies physical LOC <= 150 across auditChecks and submodules', () => {
    const files = [
      'src/services/auditChecks.ts',
      ...codeFiles('src/services/auditChecks'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('buildLocalAuditChecks aggregates checks across all categories', () => {
    const checks = buildLocalAuditChecks(mockAudit);
    expect(checks.length).toBeGreaterThan(50);
    expect(checks.every((c) => Boolean(c.id && c.label && c.status && c.category))).toBe(true);
  });

  it('evaluates HTTP and Meta checks correctly', () => {
    const httpChecks = buildHttpAndUrlChecks(mockAudit);
    expect(httpChecks.find((c) => c.id === 'http')?.status).toBe('pass');
    expect(httpChecks.find((c) => c.id === 'https')?.status).toBe('pass');

    const metaChecks = buildMetaAndIndexabilityChecks(mockAudit);
    expect(metaChecks.find((c) => c.id === 'title')?.status).toBe('pass');
  });

  it('evaluates social and headings checks correctly', () => {
    const ogChecks = buildOpenGraphChecks(mockAudit);
    expect(ogChecks.find((c) => c.id === 'og-title')?.status).toBe('pass');

    const twitterChecks = buildTwitterCardChecks(mockAudit);
    expect(twitterChecks.find((c) => c.id === 'twitter-card')?.status).toBe('pass');

    const headingChecks = buildHeadingsChecks(mockAudit);
    expect(headingChecks.find((c) => c.id === 'h1')?.status).toBe('pass');
  });

  it('evaluates media, links, security, and content checks', () => {
    const media = buildMediaChecks(mockAudit);
    expect(media.find((c) => c.id === 'images-alt')?.status).toBe('pass');

    const links = buildLinksChecks(mockAudit);
    expect(links.find((c) => c.id === 'links-total-consistent')?.status).toBe('pass');

    const security = buildSecurityChecks(mockAudit);
    expect(security.find((c) => c.id === 'security')?.status).toBe('pass');

    const structured = buildStructuredDataChecks(mockAudit);
    expect(structured.length).toBe(8);

    const technical = buildTechnicalChecks(mockAudit);
    expect(technical.length).toBe(10);

    const a11y = buildAccessibilityChecks(mockAudit);
    expect(a11y.length).toBe(11);

    const content = buildContentChecks(mockAudit);
    expect(content.find((c) => c.id === 'content-word-count')?.status).toBe('pass');

    const amp = buildAmpAndTransportChecks(mockAudit);
    expect(amp.length).toBe(12);
  });
});
