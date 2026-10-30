import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import { taxonomyMatchesCore, writeTaxonomy } from '@/services/topicalAuthorityMonitoring';
import { COMPETITORS, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const START = `https://${OWN_HOST}/`;
const taxonomy = () => referenceTaxonomy(pages) as NonNullable<ReturnType<typeof referenceTaxonomy>>;

beforeEach(() => localStorage.clear());

describe('reference taxonomy provenance and reuse (#57)', () => {
  it('records which competitors and whether Suggest gave each sub-topic', () => {
    const map = taxonomy();
    const domains = new Set(COMPETITORS.map((item) => item.domain));
    map.subtopics.forEach((subtopic) => {
      expect(subtopic.sources).toBeDefined();
      subtopic.sources!.domains.forEach((domain) => expect(domains.has(domain)).toBe(true));
      // importance is the share of real sources: never more than what was recorded
      const count = subtopic.sources!.domains.length + (subtopic.sources!.suggest ? 1 : 0);
      expect(subtopic.importance).toBeCloseTo(count / (map.competitors.length + 1), 3);
    });
    expect(map.subtopics.some((subtopic) => subtopic.sources!.suggest)).toBe(true);
  });

  it('reuses a cached map only for the same Core Topic and language', () => {
    const map = taxonomy();
    expect(taxonomyMatchesCore(map, { coreLabel: ` ${map.coreLabel.toUpperCase()} `, language: map.language })).toBe(true);
    expect(taxonomyMatchesCore(map, { coreLabel: 'garden tools', language: map.language })).toBe(false);
    expect(taxonomyMatchesCore(map, { coreLabel: map.coreLabel, language: 'xx' })).toBe(map.language === '');
    expect(taxonomyMatchesCore({ ...map, language: '' }, { coreLabel: map.coreLabel, language: 'xx' })).toBe(true);
  });

  it('does not score with a cached map built for another Core Topic', () => {
    writeTaxonomy('tx-1', { ...taxonomy(), coreLabel: 'garden tools', builtAt: new Date().toISOString() });
    writeTaxonomy('tx-2', { ...taxonomy(), builtAt: new Date().toISOString() });
    const other = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs: ownReport(pages), projectId: 'tx-1' }));
    expect(other.result.current.taxonomy).toBeNull();
    expect(other.result.current.report?.tas).toBeNull();
    const same = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs: ownReport(pages), projectId: 'tx-2' }));
    expect(same.result.current.taxonomy).not.toBeNull();
    expect(same.result.current.report?.tas).not.toBeNull();
  });
});
