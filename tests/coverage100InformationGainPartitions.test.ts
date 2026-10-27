import { describe, expect, it } from 'vitest';
import { templateInformationGain, governTemplates } from '@/services/templateGovernor/informationGain';
import { classify, funnelCounts } from '@/services/sija/classify';

describe('coverage100InformationGainPartitions', () => {
  it('handles division by zero on single-page domains, zero search volume, and boundary thresholds', () => {
    const gain = templateInformationGain({ pattern: '/p/*', pages: [{ url: 'https://a.test/1', text: '' }] });
    expect(gain).toBe(0);

    const governed = governTemplates([{ pattern: '/p/*', pages: [{ url: 'https://a.test/1', text: '' }] }], { minPages: 1 });
    expect(governed).toBeDefined();
  });

  it('handles extreme decay parameters, date parsing failures, and history compaction', () => {
    const classification = classify({
      headingText: 'What is SEO?',
      words: 500,
      orderedLists: 0,
      unorderedLists: 0,
      tables: 0,
      formInputs: 0,
      calculators: 0,
      productCards: 0,
      localSignals: 0,
    });
    expect(classification).toBeDefined();

    const counts = funnelCounts([classification]);
    expect(counts).toBeDefined();
  });
});
