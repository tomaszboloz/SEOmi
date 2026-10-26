import { describe, expect, it } from 'vitest';
import { SPRS_REFERENCE_WEIGHTS, linkZoneWeight } from '@/services/sprs/zoneWeights';
import type { CrawledLink } from '@/types/crawl/links';

const legacy: CrawledLink = { target_url: 'https://s.test/', anchor_text: 'a', is_internal: true };

describe('linkZoneWeight', () => {
  it('maps profile zones to the reference weights', () => {
    expect(SPRS_REFERENCE_WEIGHTS).toEqual({ above_fold: 1, below_fold: 0.75, widget: 0.35, nav_breadcrumb: 0.25, sidebar_footer: 0.05 });
    expect(linkZoneWeight({ zone: 'nav_breadcrumb' })).toEqual({ zone: 'nav_breadcrumb', weight: 0.25 });
    expect(linkZoneWeight({ zone: 'above_fold' }).weight).toBe(1);
  });
  it('keeps unknown, main and legacy links unweighted instead of guessing', () => {
    expect(linkZoneWeight({ zone: 'main' })).toEqual({ zone: 'main', weight: null });
    expect(linkZoneWeight(legacy)).toEqual({ zone: 'unknown', weight: null });
    expect(linkZoneWeight({ zone: null })).toEqual({ zone: 'unknown', weight: null });
    expect(linkZoneWeight({ zone: '' }).zone).toBe('unknown');
  });
  it('accepts a custom profile', () => {
    expect(linkZoneWeight({ zone: 'main' }, { main: 0.6 }).weight).toBe(0.6);
  });
});
