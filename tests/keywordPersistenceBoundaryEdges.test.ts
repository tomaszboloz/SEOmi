import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as persistence from '@/stores/tools/keywordPersistence';
import * as keys from '@/stores/tools/storageKeys';
import { useProjectStore } from '@/stores/projectStore';

const initialStore = useProjectStore.getState();
const project = { id: 'a', name: 'A', rootUrl: 'https://example.pl', createdAt: '2026-10-01', lastOpenedAt: '2026-10-01' };

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ projects: [project], activeProjectId: 'a' });
});

afterEach(() => {
  localStorage.clear();
  useProjectStore.setState(initialStore);
});

describe('keyword persistence boundary normalization', () => {
  it('defaults blank locations and derives a missing target URL from the domain', () => {
    localStorage.setItem(keys.trackedRanksKey('a'), JSON.stringify([{
      id: 'rank-a', keyword: 'fixture', domain: 'example.com', location: '  ', history: [],
    }]));
    expect(persistence.loadTrackedRanks()[0]).toMatchObject({
      id: 'rank-a', location: 'US', target_url: 'https://example.com', language_code: 'en',
    });
  });

  it('preserves custom markets and empty language values without inventing data', () => {
    localStorage.setItem(keys.trackedRanksKey('a'), JSON.stringify([{
      id: 'rank-custom', keyword: 'fixture', location: 'unsupported', language_code: '',
      domain: '', history: [],
    }]));
    expect(persistence.loadTrackedRanks()[0]).toMatchObject({
      id: 'rank-custom', location: 'unsupported', language_code: '', target_url: '',
    });
  });

  it('uses a custom language only when the stored value is a string', () => {
    localStorage.setItem(keys.trackedRanksKey('a'), JSON.stringify([{
      id: 'rank-us', keyword: 'fixture', location: 'US', language_code: 7,
      domain: '', history: [],
    }]));
    expect(persistence.loadTrackedRanks()[0]).toMatchObject({
      location: 'US', language_code: 'en', target_url: '',
    });
  });
});
