import { describe, expect, it } from 'vitest';
import { buildTrustReport } from '@/services/eeatTrust';
import { analyzeCitations } from '@/services/eeatTrust/citations';
import { buildFindings } from '@/services/eeatTrust/findings';
import { classifyProfiles } from '@/services/eeatTrust/identifiers';
import { NOW, diabetesFocus, diabetesPages, extLink, trustedArticle, withRefs } from './eeatTrustFixtures';

const pages = diabetesPages().filter((page) => page.url.includes('/articles/')).map((page) => trustedArticle(page));
const base = buildTrustReport(pages, diabetesFocus(pages), { now: NOW });
const input = { schema: base.schema, authors: base.authors, citations: base.citations, transparency: base.transparency, ymyl: undefined, unattributed: 0 };

describe('author profile evidence', () => {
  it('classifies the author sameAs links syntactically', () => {
    expect(base.authors[0].profiles.map(({ subjects: _subjects, ...profile }) => profile)).toEqual(classifyProfiles(base.authors[0].sameAs));
    expect(base.authors[0].profiles[0]).toMatchObject({ kind: 'orcid', tier: 1 });
  });
  it('flags an ORCID or Wikidata link with an invalid identifier, naming the author', () => {
    const bad = { ...base.authors[0], profiles: classifyProfiles(['https://orcid.org/0000-0002-1825-0098']) };
    const finding = buildFindings({ ...input, authors: [bad] }).find((item) => item.code === 'author-invalid-profile');
    expect(finding).toMatchObject({ severity: 'warning', params: { count: 1, names: bad.name } });
    const good = { ...base.authors[0], profiles: classifyProfiles(['https://orcid.org/0000-0002-1825-0097', 'https://x.com/anna']) };
    expect(buildFindings({ ...input, authors: [good] }).map((item) => item.code)).not.toContain('author-invalid-profile');
  });
});

describe('scholarly citation identifiers', () => {
  const article = pages[0];
  const urls = new Set([article.url]);
  it('counts unique DOI/PMID sources once across links and schema citations', () => {
    const page = withRefs(article, [], [extLink('https://doi.org/10.1000/ABC'), extLink('https://pubmed.ncbi.nlm.nih.gov/12/'), extLink('https://example.com/x')]);
    const detail = analyzeCitations([page], urls, new Map([[page.url, ['https://doi.org/10.1000/abc', 'https://evildoi.org/10.1/x']]]));
    expect(detail).toMatchObject({ pagesAnalyzed: 1, pagesWithScholarly: 1, scholarlySources: 2 });
  });
  it('reports zero when no cited source carries an identifier', () => {
    const detail = analyzeCitations([withRefs(article, [], [extLink('https://www.who.int/x')])], urls, new Map());
    expect(detail).toMatchObject({ pagesWithScholarly: 0, scholarlySources: 0 });
  });
  it('raises the YMYL finding only with analyzed articles and no identified source', () => {
    const none = { ...input.citations, pagesAnalyzed: 3, scholarlySources: 0 };
    const finding = buildFindings({ ...input, ymyl: 'health', citations: none }).find((item) => item.code === 'ymyl-no-scholarly-ids');
    expect(finding).toMatchObject({ severity: 'info', params: { pages: 3 } });
    const codes = (citations: typeof none, ymyl?: 'health') => buildFindings({ ...input, ymyl, citations }).map((item) => item.code);
    expect(codes({ ...none, scholarlySources: 1 }, 'health')).not.toContain('ymyl-no-scholarly-ids');
    expect(codes(none)).not.toContain('ymyl-no-scholarly-ids');
    expect(codes({ ...none, pagesAnalyzed: 0 }, 'health')).not.toContain('ymyl-no-scholarly-ids');
  });
});
