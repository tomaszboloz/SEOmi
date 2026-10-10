import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsTabBar } from '@/components/Settings/settings/SettingsTabBar';
import { CrawlResultsTabStrip } from '@/components/Domain/crawlResults/CrawlResultsTabStrip';
import { tabs } from '@/components/Domain/crawlResults/crawlResultsHelpers';
import type { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import type { SettingsTabType } from '@/components/Settings/settings/settingsTypes';
import i18n from '@/i18n';

describe('direct settings and crawl navigation callbacks', () => {
  it('dispatches every settings tab and displays the controlled selected tab', () => {
    const update = vi.fn();
    const ids: SettingsTabType[] = ['general', 'api', 'workspace', 'language', 'updates'];
    const view = render(<SettingsTabBar activeTab="general" setActiveTab={update} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(ids.length);
    ids.forEach((id, index) => {
      fireEvent.click(buttons[index]);
      expect(update).toHaveBeenLastCalledWith(id);
      view.rerender(<SettingsTabBar activeTab={id} setActiveTab={update} />);
      expect(buttons[index].className).toContain('border-emerald-500');
      expect(buttons.filter((button) => button.className.includes('border-emerald-500'))).toHaveLength(1);
    });
  });
  it('dispatches scroll boundaries, selection and keyboard navigation with accessible state', () => {
    const scroll = vi.fn();
    const setActiveTab = vi.fn();
    const selectTabByKey = vi.fn();
    const tabScrollerRef = createRef<HTMLDivElement>();
    const session = { activeTab: tabs[0].id, localizedTabLabel: (tab: typeof tabs[number]) => tab.id,
      scrollTabStrip: scroll, setActiveTab, selectTabByKey, t: i18n.t, tabScrollerRef,
      tabCounts: Object.fromEntries(tabs.map((tab, index) => [tab.id, index])),
    } as unknown as ReturnType<typeof useCrawlResultsSession>;
    const view = render(<CrawlResultsTabStrip session={session} />);
    expect(tabScrollerRef.current?.id).toBe('crawl-tab-strip');
    for (const [key, direction] of [['Start', 'start'], ['Left', 'left'], ['Right', 'right'], ['End', 'end']]) {
      const button = screen.getByRole('button', { name: i18n.t(`crawl.navigation.scrollTabs${key}`) });
      fireEvent.click(button);
      expect(scroll).toHaveBeenLastCalledWith(direction);
      expect(button.getAttribute('aria-controls')).toBe('crawl-tab-strip');
    }
    const buttons = screen.getAllByRole('tab');
    expect(buttons).toHaveLength(tabs.length);
    buttons.forEach((button, index) => {
      expect(within(button).getByText(String(index))).toBeTruthy();
      fireEvent.click(button);
      expect(setActiveTab).toHaveBeenLastCalledWith(tabs[index].id);
    });
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(selectTabByKey).toHaveBeenCalledOnce();
    view.rerender(<CrawlResultsTabStrip session={{ ...session, activeTab: tabs[1].id }} />);
    expect(buttons[0].tabIndex).toBe(-1);
    expect(buttons[1].tabIndex).toBe(0);
    expect(buttons[1].getAttribute('aria-selected')).toBe('true');
  });
});
