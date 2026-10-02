import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrawlTabNavigation } from '../src/components/Domain/crawlResults/session/useCrawlTabNavigation';
import { useCrawlMapState } from '../src/components/Domain/crawlResults/session/useCrawlMapState';
import { useCrawlExportHandlers } from '../src/components/Domain/crawlResults/session/useCrawlExportHandlers';
import { defaultDependencies } from '../src/components/Domain/crawlResults/session/crawlResultsSessionTypes';

vi.mock('react-i18next', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
    initReactI18next: { type: '3rdParty', init: vi.fn() }
  };
});

describe('Crawl Session Modules', () => {
  it('useCrawlTabNavigation initializes correctly', () => {
    const { result } = renderHook(() => useCrawlTabNavigation({
      activeTab: 'urls',
      activeTabGroup: 'core',
      metadataFacet: 'all',
      validationQuery: '',
      validationSeverity: 'all'
    }));

    expect(result.current.activeTab).toBe('urls');
    expect(result.current.activeTabGroup).toBe('core');
  });

  it('useCrawlMapState opens map section', () => {
    const setActiveTab = vi.fn();
    const resultsRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useCrawlMapState(1, setActiveTab, resultsRef));
    
    act(() => {
      result.current.openMapSection();
    });

    expect(setActiveTab).toHaveBeenCalledWith('visualisations');
  });

  it('useCrawlExportHandlers sets artifact states', async () => {
    const crawlResult = { start_url: 'https://example.com', pages: [] } as any;
    const { result } = renderHook(() => useCrawlExportHandlers(crawlResult, undefined, defaultDependencies));
    
    expect(result.current.renderedArtifactUrl).toBe('https://example.com');
  });
});
