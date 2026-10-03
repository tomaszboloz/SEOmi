import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { returnToMapStart, returnToResults, scrollMapTabs } from '@/components/Charts/crawlArchitecture/CrawlArchitectureHelpers';

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('public crawl map navigation actions', () => {
  it.each([false, true])('scrolls tabs in both directions and honors reduced motion=%s', (reduced) => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduced }));
    const ref = createRef<HTMLDivElement>();
    const scrollBy = vi.fn();
    ref.current = document.createElement('div');
    ref.current.scrollBy = scrollBy;
    scrollMapTabs('left', ref);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -260, behavior: reduced ? 'auto' : 'smooth' });
    scrollMapTabs('right', ref);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 260, behavior: reduced ? 'auto' : 'smooth' });
    ref.current = null;
    expect(() => scrollMapTabs('left', ref)).not.toThrow();
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])('scrolls and focuses the requested section with reduced motion=%s', (reduced) => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduced }));
    for (const [id, action] of [['crawl-results', returnToResults], ['crawl-map-section', returnToMapStart]] as const) {
      const element = document.createElement('section');
      element.id = id; element.tabIndex = -1;
      element.scrollIntoView = vi.fn();
      document.body.append(element);
      action();
      expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      expect(document.activeElement).toBe(element);
      element.remove();
      expect(action).not.toThrow();
    }
  });

  it('supports browsers without matchMedia or optional scrolling methods', () => {
    vi.stubGlobal('matchMedia', undefined);
    const element = document.createElement('div');
    element.id = 'crawl-results'; element.scrollIntoView = vi.fn();
    document.body.append(element);
    returnToResults();
    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    const ref = createRef<HTMLDivElement>(); ref.current = document.createElement('div');
    expect(() => scrollMapTabs('right', ref)).not.toThrow();
  });
});
