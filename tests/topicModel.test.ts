// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { coreKeysOf } from '@/services/topicalAuthority/context';
import { topicModelOf } from '@/services/topicModel';
import { modelOf } from '@/services/siteFocus/incremental';
import type { SiteFocusReport } from '@/services/siteFocus/types';

const report = {
  coreTopic: { label: 'Diabetes' },
  model: {
    language: 'en', pageCount: 3, documentFrequency: {}, termCluster: { insulin: 'c1', glucose: 'c1', phone: 'c2' },
    coreWeights: { insulin: 2, glucose: 1 }, kCore: ['insulin', 'glucose'], coreClusterId: 'c1', clusterLabels: { c1: 'Diabetes', c2: 'Phones' }, surfaces: {},
  },
} as unknown as SiteFocusReport;

describe('shared TopicModel (#106)', () => {
  it('exposes the core cluster, labels and lookups once', () => {
    const topic = topicModelOf(report);
    expect(topic.coreLabel).toBe('Diabetes');
    expect([...topic.coreKeys].sort()).toEqual(['glucose', 'insulin']);
    expect(topic.clusterOf('phone')).toBe('c2');
    expect(topic.clusterOf('unknown')).toBeUndefined();
    expect(topic.coreWeights.get('insulin')).toBe(2);
    expect(topic.clusterLabels.c2).toBe('Phones');
  });
  it('feeds incremental scoring and Topical Authority from the same model', () => {
    expect([...coreKeysOf(report)].sort()).toEqual(['glucose', 'insulin']);
    const scoring = modelOf(report);
    expect(scoring.coreClusterId).toBe('c1');
    expect(scoring.kCore).toEqual(['insulin', 'glucose']);
    expect(scoring.termCluster.get('phone')).toBe('c2');
    expect(scoring.coreWeights.get('glucose')).toBe(1);
  });
});
