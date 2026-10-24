import { describe, expect, it } from 'vitest';
import { auditSilo } from '@/services/topicalAuthority/silo';
import { authorityContext, authorityPage } from './authorityDirectFixtures';

describe('direct silo connectivity branches', () => {
  it.each([false, true])('handles sibling connectivity and equal-rank URL tie breaks (reverse=%s)', (reverse) => {
    const pages = ['a', 'b', 'c', 'd'].map((name) => authorityPage(`https://silo.test/${name}`));
    pages.forEach((entry) => { entry.page.links = pages.filter((target) => target !== entry).map((target) => ({
      target_url: target.url, is_internal: true, zone: 'main', anchor_text: 'topic',
    })); });
    if (reverse) pages.reverse();
    const report = auditSilo(authorityContext(pages), pages, new Map([['p', pages]]));
    expect(report.clusterConnectivity).toBe(1);
    expect(report.audits['https://silo.test/d'].pillarUrl).toBe('https://silo.test/a');
    expect(report.orphans).toEqual([]);
  });
});
