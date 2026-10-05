import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlArchitectureHeader } from '@/components/Charts/crawlArchitecture/CrawlArchitectureHeader';
import type { MapView } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';
import i18n from '@/i18n';

const setup = (activeView: MapView = 'graph') => {
  const setActiveView = vi.fn();
  const ref = createRef<HTMLDivElement>();
  render(<CrawlArchitectureHeader activeView={activeView} setActiveView={setActiveView} mapTabsRef={ref} />);
  return { setActiveView, ref };
};
const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(i18n.t(`mapUi.tabs.${name}`)) });

describe('CrawlArchitectureHeader', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  });

  it('shows the active view label and marks only it as selected', () => {
    setup('directory');
    expect(tab('directory').getAttribute('aria-selected')).toBe('true');
    expect(tab('graph').getAttribute('aria-selected')).toBe('false');
    expect(tab('graph').getAttribute('tabindex')).toBe('-1');
    const live = document.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe(`${i18n.t('mapUi.active')}: ${i18n.t('mapUi.tabs.directory')}`);
  });

  it('styles each selected view with its own accent', () => {
    for (const [view, cls] of [['graph', 'bg-slate-800'], ['directory', 'bg-sky-500/15'], ['plan', 'bg-emerald-500/15']] as const) {
      const { unmount } = render(
        <CrawlArchitectureHeader activeView={view} setActiveView={vi.fn()} mapTabsRef={createRef<HTMLDivElement>()} />,
      );
      expect(tab(view).className).toContain(cls);
      unmount();
    }
  });

  it('switches view on click', () => {
    const { setActiveView } = setup();
    fireEvent.click(tab('plan'));
    expect(setActiveView).toHaveBeenCalledWith('plan');
  });

  it('navigates with arrows, wrapping at both ends, and focuses the target', () => {
    const { setActiveView } = setup('graph');
    fireEvent.keyDown(tab('graph'), { key: 'ArrowRight' });
    expect(setActiveView).toHaveBeenLastCalledWith('directory');
    expect(document.activeElement).toBe(tab('directory'));
    fireEvent.keyDown(tab('graph'), { key: 'ArrowLeft' });
    expect(setActiveView).toHaveBeenLastCalledWith('plan');
  });

  it('jumps to first and last with Home and End', () => {
    const { setActiveView } = setup('directory');
    fireEvent.keyDown(tab('directory'), { key: 'End' });
    expect(setActiveView).toHaveBeenLastCalledWith('plan');
    fireEvent.keyDown(tab('directory'), { key: 'Home' });
    expect(setActiveView).toHaveBeenLastCalledWith('graph');
  });

  it('ignores other keys and events from select elements', () => {
    const { setActiveView } = setup();
    fireEvent.keyDown(tab('graph'), { key: 'x' });
    const select = document.createElement('select');
    screen.getByRole('tablist').appendChild(select);
    fireEvent.keyDown(select, { key: 'ArrowRight' });
    expect(setActiveView).not.toHaveBeenCalled();
  });

  it('scrolls the tab strip with the chevron buttons', () => {
    const { ref } = setup();
    const scrollBy = vi.fn();
    ref.current!.scrollBy = scrollBy;
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mapUi.scrollTabsRight') }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 260, behavior: 'smooth' });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mapUi.scrollTabsLeft') }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -260, behavior: 'smooth' });
  });

  it('returns focus to the results section', () => {
    setup();
    const results = document.createElement('section');
    results.id = 'crawl-results';
    results.tabIndex = -1;
    results.scrollIntoView = vi.fn();
    document.body.append(results);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mapUi.backToResults') }));
    expect(results.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(results);
    results.remove();
  });
});
