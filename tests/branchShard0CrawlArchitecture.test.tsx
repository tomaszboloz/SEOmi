import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { CrawlArchitectureBottomNav } from '@/components/Charts/crawlArchitecture/CrawlArchitectureBottomNav';
import { CrawlArchitectureSidebar } from '@/components/Charts/crawlArchitecture/CrawlArchitectureSidebar';
import { useUIStore } from '@/stores/uiStore';

const ui = useUIStore.getState();
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); useUIStore.setState(ui); });

it.each([[true, 'md:left-[4.5rem]', 'md:left-[16.5rem]'], [false, 'md:left-[16.5rem]', 'md:left-[4.5rem]']])(
  'offsets the bottom navigation for the sidebar state (collapsed=%s)', (collapsed, present, absent) => {
    useUIStore.setState({ sidebarCollapsed: collapsed });
    render(<CrawlArchitectureBottomNav activeView="graph" setActiveView={() => undefined} bottomMapTabsRef={createRef<HTMLDivElement>()} />);
    const wrapper = screen.getByRole('navigation').parentElement as HTMLElement;
    expect(wrapper.className).toContain(present);
    expect(wrapper.className).not.toContain(absent);
  },
);

it('labels unnamed diagnosis topics in the legend with the localized placeholder', () => {
  render(<CrawlArchitectureSidebar
    graph={{ clusters: [] }} selectedNode={null} selectedId={null} selectedTopicEdges={[]} selectedOutboundEdges={[]}
    nodeById={new Map()} linkMode="content" crawlMode="http"
    diagnosis={{ topics: [{ id: 't1', label: '', documentIds: ['a', 'b'] }, { id: 't2', label: 'Named', documentIds: ['c'] }] }}
  />);
  expect(screen.getByText(new RegExp(i18n.t('topicalDiagnosis.topics.noLabel')))).toBeTruthy();
  expect(screen.getByText(/Named/)).toBeTruthy();
});
