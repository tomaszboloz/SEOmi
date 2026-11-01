import { describe, expect, it } from 'vitest';
import { buildTemplateEvents } from '@/components/Charts/semanticTopical/signals/templateAdapter';
import { CrawledPageSummarySchema } from '@/services/contracts/crawl/crawlSummary';

const page = (index: number) => CrawledPageSummarySchema.parse({
  url: `https://site.test/dieta-cukrzycowa-miasto${index}`, final_url: `https://site.test/dieta-cukrzycowa-miasto${index}`, redirect_chain: [], depth: 1,
  http_status: 200, response_time_ms: 90, indexability_status: 'Eligible response only', body_truncated: false, word_count: 240, schema_types: [], schema_syntax_errors: 0,
  hreflangs: [], h1_count: 1, internal_link_count: 3, external_link_count: 1, links: [], images: [], issues_count: 0, issues: [], semantic_excerpts: ['Dieta cukrzycowa i plan posiłków.'],
  template_dom_signature: '0:body>1:main>2:article>3:h1>3:p',
});

describe('500 local pages of one template (#139 fixture proof, documented in .github/CALIBRATION_DEFAULTS.md)', () => {
  it('give exactly one template event listing all URLs', () => {
    const events = buildTemplateEvents(Array.from({ length: 500 }, (_, index) => page(index)));
    expect(events).toHaveLength(1);
    expect(events[0].pageCount).toBe(500);
    expect(events[0].urls).toHaveLength(500);
  });
});
