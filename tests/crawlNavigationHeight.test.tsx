import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrawlResultsTabs } from '@/components/Domain/CrawlResultsTabs';
import { result } from './fixtures/crawlResultsTabsContracts';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('navigation height and map scroll offset', () => {
  it('tracks a translated tab bar growing on resize and releases the observer', () => {
    let height = 159;
    let resize!: () => void;
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      height, width: 700, x: 0, y: 0, top: 0, right: 700, bottom: height, left: 0,
      toJSON: () => ({}),
    }));
    const view = render(<CrawlResultsTabs result={result} runs={[]} onSelectRun={vi.fn()} />);
    const section = screen.getByRole('region', { name: /Crawl results|Wyniki crawl/i });
    expect(section.style.getPropertyValue('--crawl-navigation-height')).toBe('159px');
    height = 208;
    act(() => resize());
    expect(section.style.getPropertyValue('--crawl-navigation-height')).toBe('208px');
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(section.style.getPropertyValue('--crawl-navigation-height')).toBe('');
    act(() => resize());
    expect(section.style.getPropertyValue('--crawl-navigation-height')).toBe('');
  });
});
