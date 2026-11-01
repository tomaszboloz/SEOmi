import { render, renderHook, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import i18n from '@/i18n';
import { CrawlArchitectureSidebar } from '@/components/Charts/crawlArchitecture/CrawlArchitectureSidebar';
import { useTopicModel } from '@/hooks/useTopicModel';
import type { CrawledPageSummary } from '@/types';
import { diabetesSite } from './siteFocusFixtures';

const sidebar = (selectedNode: object) => render(<CrawlArchitectureSidebar
  graph={{ clusters: [] }} selectedNode={selectedNode as never} selectedId="n" selectedTopicEdges={[]} selectedOutboundEdges={[]}
  nodeById={new Map()} linkMode="content" crawlMode="http" diagnosis={null as never}
/>);
const node = (extra: object) => ({ id: 'n', page: { url: 'https://a.test/x', title: 'X' }, clusterLabel: 'c', semanticSignalCount: 2, incomingContentLinks: 1, ...extra });

it('builds the shared topic model from a crawl and degrades to undefined (#106)', () => {
  const pages = diabetesSite('diabetes.test') as unknown as CrawledPageSummary[];
  const { result } = renderHook(() => useTopicModel('p1', pages, 'https://diabetes.test/'));
  expect(result.current?.coreKeys.size).toBeGreaterThan(0);
  expect(renderHook(() => useTopicModel('p1', [], 'https://diabetes.test/')).result.current).toBeUndefined();
  const broken = [{ url: null }] as unknown as CrawledPageSummary[];
  expect(renderHook(() => useTopicModel('p1', broken, 'https://diabetes.test/')).result.current).toBeUndefined();
});

it('shows the core topic share of the selected page only when it is known', () => {
  const { unmount } = sidebar(node({ coreTopicShare: 0.5 }));
  expect(screen.getByTestId('core-topic-share').textContent).toBe(i18n.t('mapUi.coreTopicShare', { percent: 50 }));
  unmount();
  sidebar(node({}));
  expect(screen.queryByTestId('core-topic-share')).toBeNull();
});
