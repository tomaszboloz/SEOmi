import { expect, it, vi } from 'vitest';

vi.mock('@/services/dataforseoCatalog/catalogMetrics', () => ({ CATALOG_METRICS: {} }));

import { DATAFORSEO_LOCATION_CATALOG } from '@/services/dataforseoCatalog';

it('uses zeroed metrics when a location has no catalog metrics entry', () => {
  expect(DATAFORSEO_LOCATION_CATALOG.length).toBeGreaterThan(0);
  DATAFORSEO_LOCATION_CATALOG.forEach((row) => {
    expect(row).toMatchObject({ locationCodeParent: null, keywords: 0, serps: 0 });
  });
});
