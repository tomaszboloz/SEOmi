import { describe, expect, it } from 'vitest';
import { buildAuthorityReport, buildGapBrief } from '@/services/topicalAuthority';
import { buildAuthorityRecommendations } from '@/services/topicalAuthority/recommend';
import { authorityCoverage } from './authorityDirectFixtures';
import { NOW, OWN_HOST, ownReport, ownSite } from './authorityFixtures';

const report = buildAuthorityReport(ownSite(), `https://${OWN_HOST}/`, ownReport(), { now: NOW });

describe('direct authority report branches', () => {
  it('leaves an empty heading empty and sorts pillar mates lacking measured depths', () => {
    const gap = authorityCoverage({ subtopicId: 'gap', label: '', coverage: 0, status: 'missing_gap' });
    const mates = [authorityCoverage({ bestUrl: '/first', similarity: 90 }), authorityCoverage({ bestUrl: '/second', similarity: 60 })];
    const brief = buildGapBrief({ ...report, taxonomy: null, coverage: [gap, ...mates] }, gap);
    expect(brief).toMatchObject({ h1: '', linkFrom: '/first', linkTo: '/second' });
  });

  it('orders equal-gain pillar recommendations lexically rather than by input order', () => {
    const coverage = ['z', 'a', 'm'].map((pillar) => authorityCoverage({ pillar, coverage: 0, status: 'missing_gap' }));
    const recommendations = buildAuthorityRecommendations({ ...report, coverage,
      pillars: { tcr: 100, cdes: 100, silc: 100, cvff: 100 }, pillarLabels: new Map() });
    expect(recommendations.filter((item) => item.code === 'fill-gaps').map((item) => item.params.pillar)).toEqual(['a', 'm', 'z']);
  });
});
