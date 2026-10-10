import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrawlNavigationHeight } from '@/components/Domain/crawlResults/useCrawlNavigationHeight';

describe('useCrawlNavigationHeight direct assertions', () => {
  it('updates CSS variable on target element from navigation height', () => {
    const nav = document.createElement('div');
    vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({ height: 48 } as DOMRect);

    const section = document.createElement('section');
    const navRef = { current: nav };
    const sectionRef = { current: section };

    const { unmount } = renderHook(() => useCrawlNavigationHeight(navRef, sectionRef));
    expect(section.style.getPropertyValue('--crawl-navigation-height')).toBe('48px');

    unmount();
    expect(section.style.getPropertyValue('--crawl-navigation-height')).toBe('');
  });

  it('does nothing when refs are not attached', () => {
    const navRef = { current: null };
    const sectionRef = { current: null };

    expect(() => {
      const { unmount } = renderHook(() => useCrawlNavigationHeight(navRef, sectionRef));
      unmount();
    }).not.toThrow();
  });
});
