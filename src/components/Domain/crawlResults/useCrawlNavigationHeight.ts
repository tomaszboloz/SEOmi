import { useEffect, type RefObject } from 'react';

export const useCrawlNavigationHeight = (
  navigation: RefObject<HTMLDivElement | null>,
  results: RefObject<HTMLElement | null>,
): void => {
  useEffect(() => {
    const bar = navigation.current;
    const section = results.current;
    if (!bar || !section) return;
    let active = true;
    const update = () => {
      if (!active) return;
      const height = bar.getBoundingClientRect().height;
      if (Number.isFinite(height) && height > 0) {
        section.style.setProperty('--crawl-navigation-height', `${height}px`);
      }
    };
    update();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(bar);
    return () => {
      active = false;
      observer?.disconnect();
      section.style.removeProperty('--crawl-navigation-height');
    };
  }, [navigation, results]);
};
