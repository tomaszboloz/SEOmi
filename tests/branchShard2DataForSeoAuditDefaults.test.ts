import { expect, it, vi } from 'vitest';

vi.mock('@/services/dataforseo', () => ({
  DATAFORSEO_MARKETS: [{ code: 'XX', label: 'Nowhere', locationCode: 0, languages: [] }],
}));

import { defaultLanguageCode, defaultLocationCode, defaultMarket } from '@/components/Results/dataforseoAudit/dataforseoAuditTypes';

it('falls back to the first market and to US English defaults when the catalog has no usable US entry', () => {
  expect(defaultMarket.code).toBe('XX');
  expect(defaultLocationCode).toBe(2840);
  expect(defaultLanguageCode).toBe('en');
});
