import { describe, expect, it } from 'vitest';
import { extractCitationReferences, mapClaimsToCitations } from '@/services/citationEvidence/claims';
import { analyzeCitations } from '@/services/eeatTrust/citations';
import type { RagSection } from '@/types';
import { createCrawlPageFixture as page } from './fixtures/crawl';

const URL_A = 'https://s.test/article';
const section = (paragraphs: string[]): RagSection => ({ heading: 'Sources', level: 2, paragraphs, tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0 });
const pmids = (text: string) => extractCitationReferences(text).filter((ref) => ref.kind === 'pmid').map((ref) => ref.key);

describe('PMID detection', () => {
  it('needs the PMID label, so plain numbers are not citations', () => {
    expect(pmids('The city has 1250000 residents and postcode 80123.')).toEqual([]);
    expect(pmids('See PMID: 123 and PMID 34567890, also PMID#555.')).toEqual(['pmid:123', 'pmid:34567890', 'pmid:555']);
  });

  it('leaves a high-stakes claim next to a bare number unmatched', () => {
    const [claim] = mapClaimsToCitations('Patients had a 20% lower risk in 1250000 records.');
    expect(claim.relation).toBe('unmatched');
  });
});

describe('scholarly sources written in the page text', () => {
  it('counts DOI, PMID and PMCID from excerpts and section paragraphs, deduplicated with linked ones', () => {
    const article = page({
      url: URL_A, final_url: URL_A,
      semantic_excerpts: ['Risk fell by 20% (doi:10.1000/abc).'],
      rag_sections: [section(['1. Smith J. Trial. PMID: 4567. PMC1234567.', '2. Same paper: https://doi.org/10.1000/ABC'])],
      links: [{ target_url: 'https://doi.org/10.1000/abc', is_internal: false, anchor_text: 'doi' }] as never,
    });
    const detail = analyzeCitations([article], new Set([URL_A]), new Map());
    expect(detail.pagesWithScholarly).toBe(1);
    expect(detail.scholarlySources).toBe(3);
  });

  it('does not count a page whose text has only plain numbers', () => {
    const article = page({ url: URL_A, final_url: URL_A, semantic_excerpts: ['We served 125000 customers in 2025.'], links: [] });
    expect(analyzeCitations([article], new Set([URL_A]), new Map())).toMatchObject({ pagesWithScholarly: 0, scholarlySources: 0 });
  });
});
