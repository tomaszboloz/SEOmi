import { describe, expect, it } from 'vitest';
import { auditCsv, auditImagesCsv, auditLinksCsv, backlinkGapCsv } from '@/services/export';
import { BacklinkGapReport, PageAuditData } from '@/types';
import { audit } from './fixtures/export';

describe('export contracts: overview', () => {
  it('exports real audit values and neutralizes spreadsheet formulas', () => {
      const csv = auditCsv(audit);
      expect(csv).toContain("'=unsafe");
      expect(auditCsv({ ...audit, meta_tags: { ...audit.meta_tags, title: ' \t=unsafe after whitespace' } })).toContain("' \t=unsafe after whitespace");
      expect(csv).toContain('Needs ""quotes""');
      expect(csv).toContain('"88"');
    });

  it('exports every audit link and image with spreadsheet-safe cells', () => {
      const fullAudit = {
        ...audit,
        links: { total_links: 1, links: [{ href: '=unsafe-link', text: '+unsafe anchor', is_internal: true, rel: 'nofollow' }] },
        images: [{ src: '@unsafe-image', alt: '-unsafe alt', has_alt: false }],
      } as unknown as PageAuditData;

      expect(auditLinksCsv(fullAudit)).toContain("'=unsafe-link");
      expect(auditLinksCsv(fullAudit)).toContain("'+unsafe anchor");
      expect(auditImagesCsv(fullAudit)).toContain("'@unsafe-image");
      expect(auditImagesCsv(fullAudit)).toContain("'-unsafe alt");
      expect(auditLinksCsv(fullAudit)).toContain('Audited URL');
      expect(auditImagesCsv(fullAudit)).toContain('Has ALT');
    });

  it('exports competitors and referring domains while neutralizing spreadsheet formulas', () => {
      const report = {
        target: 'example.com', competitors: ['competitor.example'], include_subdomains: true, rows_scanned: 1, total_rows: 1,
        opportunities: [{ referring_domain: '=unsafe.example', target_backlinks: 0, competitor_backlinks: [{ domain: 'competitor.example', backlinks: 4, rank: 55 }], max_competitor_spam_score: 12 }],
      } as BacklinkGapReport;
      const output = backlinkGapCsv(report);
      expect(output).toContain('API rows scanned');
      expect(output).toContain('competitor.example backlinks');
      expect(output).toContain("'=unsafe.example");
      expect(output).toContain('"4"');
    });
});
