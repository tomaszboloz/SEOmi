import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { validateProjectRootUrl } from '@/services/projectValidation';
import { buildTopTenContentGap } from '@/services/targetPhraseAudit/contentGap';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { assignRoles } from '@/services/topicalDiagnosis/roles';
import { brandKeysFor } from '@/services/topicalDiagnosis/similarity';
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE,
  loadSelectedCrawlReportTemplateId,
  saveCrawlReportTemplate,
} from '@/services/reportTemplates';
import { createCrawlPageFixture } from './fixtures/crawl';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('remaining service evidence paths', () => {
  it('applies the private-range policy to a dotted IPv4-mapped IPv6 hostname', () => {
    class DottedMappedUrl {
      protocol = 'http:';
      hostname = '::ffff:10.0.0.1';
      username = '';
      password = '';
      toString = () => 'http://[::ffff:10.0.0.1]';
    }
    vi.stubGlobal('URL', DottedMappedUrl);
    expect(validateProjectRootUrl('mapped.test')).toEqual({
      ok: false,
      message: i18n.t('projects.validation.privateUrl'),
    });
  });

  it('keeps an invalid original URL from hiding a matching final URL in supplied evidence', () => {
    const report = buildTopTenContentGap({
      phrase: 'SEO',
      rows: [{ type: 'organic', rank_absolute: 1, url: 'https://requested.test/' }],
      evidence: [{
        url: 'https://requested.test/', fetchedAt: '2026-10-01',
        audit: { url: 'not a url', final_url: 'https://requested.test/', http_status: 200, content_stats: { body_text: 'SEO guide' } } as never,
      }],
    });
    expect(report.rows[0]).toMatchObject({ availability: 'available', finalUrl: 'https://requested.test/' });
  });

  it('classifies a malformed primary URL as content instead of throwing in role assignment', () => {
    const page = createCrawlPageFixture({ url: 'not a url', final_url: 'not a url', word_count: 10 });
    const documents = buildDiagnosisDocuments([page], 'https://example.test/').documents;
    expect(assignRoles(documents)[0].role).toBe('content');
  });

  it('does not invent a brand token when the root has no registrable domain', () => {
    const page = createCrawlPageFixture({ semantic_language: 'pl', semantic_terms: ['local'] });
    const documents = buildDiagnosisDocuments([page], 'https://localhost/').documents;
    expect(brandKeysFor('https://localhost/', documents)).toEqual(new Set());
  });

  it('uses the built-in template when a stored selection is empty', () => {
    saveCrawlReportTemplate('selection-edge', { id: 'custom-edge', name: 'Custom', sections: ['summary'] });
    localStorage.setItem('seomi_project_selection-edge_report_template_selection_v1', '');
    expect(loadSelectedCrawlReportTemplateId('selection-edge')).toBe(DEFAULT_CRAWL_REPORT_TEMPLATE.id);
  });
});
