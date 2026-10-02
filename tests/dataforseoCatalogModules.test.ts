import { describe, expect, it } from 'vitest';
import { DATAFORSEO_LOCATION_CATALOG } from '@/services/dataforseoCatalog';
import { CATALOG } from '@/services/dataforseoCatalog/catalogEntries';
import { CATALOG_METRICS } from '@/services/dataforseoCatalog/catalogMetrics';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

describe('DataForSEO Catalog modular architecture', () => {
  it('satisfies physical LOC <= 150 across catalog files', () => {
    const files = [
      'src/services/dataforseoCatalog.ts',
      ...codeFiles('src/services/dataforseoCatalog'),
    ];
    expect(files.length).toBe(4);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('exports accurate catalog list matching entries and metrics', () => {
    expect(DATAFORSEO_LOCATION_CATALOG.length).toBe(CATALOG.length);
    expect(DATAFORSEO_LOCATION_CATALOG.length).toBeGreaterThan(50);

    const poland = DATAFORSEO_LOCATION_CATALOG.find((row) => row.locationCode === 2616 && row.languageCode === 'pl');
    expect(poland).toBeDefined();
    expect(poland?.locationName).toBe('Poland');
    expect(poland?.countryIsoCode).toBe('PL');
    expect(poland?.languageName).toBe('Polish');
    expect(poland?.keywords).toBe(CATALOG_METRICS['2616:pl'].keywords);
    expect(poland?.serps).toBe(CATALOG_METRICS['2616:pl'].serps);
  });

  it('handles entries without metrics gracefully', () => {
    const usEn = DATAFORSEO_LOCATION_CATALOG.find((row) => row.locationCode === 2840 && row.languageCode === 'en');
    expect(usEn).toBeDefined();
    expect(usEn?.availableSources).toContain('google');
  });
});
