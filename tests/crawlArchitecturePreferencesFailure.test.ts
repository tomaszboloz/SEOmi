import { describe, expect, it, vi } from 'vitest';
import { emptyPreferences, readPreferences } from '@/components/Charts/crawlArchitecture/CrawlArchitectureHelpers';
import { readJsonRecord } from '@/services/storageContracts';

vi.mock('@/services/storageContracts', () => ({
  readJsonRecord: vi.fn(),
  parseRecordEntries: () => { throw new Error('corrupt entries'); },
}));

describe('readPreferences failure handling', () => {
  it('falls back to defaults when no record is stored', () => {
    vi.mocked(readJsonRecord).mockReturnValue(null as never);
    expect(readPreferences('any-key')).toEqual(emptyPreferences());
  });

  it('falls back to defaults when parsing stored entries throws', () => {
    vi.mocked(readJsonRecord).mockReturnValue({ positions: {} });
    expect(readPreferences('any-key')).toEqual(emptyPreferences());
  });
});
