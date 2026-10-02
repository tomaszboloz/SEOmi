import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlDirectoryTree } from '@/components/Charts/CrawlDirectoryTree';
import { createCrawlPageFixture as page } from './fixtures/crawl';
import i18n from '@/i18n';

const label = (key: string, values?: Record<string, unknown>) => i18n.t(`crawlDirectoryUi.${key}`, values);
const key = (project: string, run = 'run') => `seomi_project_${project}_crawl_directory_${run}_v1`;

describe('crawl directory interactions', () => {
  it('filters actual pages, selects a URL, displays observed metrics and persists selection', () => {
    const onSelectPage = vi.fn();
    const pages = [page({ url: 'https://site.test/?alpha', title: 'Alpha', http_status: 404, indexability_status: 'Excluded by response' }), page({ url: 'https://site.test/?beta', title: 'Beta', indexability_status: undefined })];
    const view = render(<CrawlDirectoryTree pages={pages} projectId="project" runId="run" onSelectPage={onSelectPage} />);
    fireEvent.change(screen.getByLabelText(label('filterAria')), { target: { value: 'alpha' } });
    expect(view.container.querySelectorAll('button[title]')).toHaveLength(1);
    fireEvent.click(screen.getByTitle(pages[0].url));
    expect(onSelectPage).toHaveBeenCalledWith(pages[0].url);
    expect(view.container.querySelector('aside')?.textContent).toContain('404');
    expect(JSON.parse(localStorage.getItem(key('project'))!).selectedUrl).toBe(pages[0].url);
    fireEvent.change(screen.getByLabelText(label('filterAria')), { target: { value: '' } });
    fireEvent.click(screen.getByTitle(pages[1].url));
    expect(view.container.querySelector('aside')?.textContent).toContain(label('indexabilityUnknown'));
  });

  it('keeps project and run preferences isolated and does not persist a projectless view', () => {
    localStorage.setItem(key('one'), JSON.stringify({ query: 'Alpha' }));
    localStorage.setItem(key('two'), JSON.stringify({ query: 'Beta' }));
    const props = { pages: [], projectId: 'one', runId: 'run' };
    const view = render(<CrawlDirectoryTree {...props} />);
    const query = () => (screen.getByLabelText(label('filterAria')) as HTMLInputElement).value;
    expect(query()).toBe('Alpha');
    view.rerender(<CrawlDirectoryTree {...props} projectId="two" />);
    expect(query()).toBe('Beta');
    expect(JSON.parse(localStorage.getItem(key('one'))!).query).toBe('Alpha');
    view.rerender(<CrawlDirectoryTree {...props} projectId="two" runId="next" />);
    expect(query()).toBe('');
    const size = localStorage.length;
    view.rerender(<CrawlDirectoryTree {...props} projectId={null} />);
    fireEvent.change(screen.getByLabelText(label('filterAria')), { target: { value: 'temporary' } });
    expect(localStorage.length).toBe(size);
  });

  it('supports bounded page pagination and reversible expansion without a selection callback', () => {
    const pages = Array.from({ length: 101 }, (_, i) => page({ url: `https://site.test/?page=${i}`, title: `Page ${i}` }));
    const view = render(<CrawlDirectoryTree pages={pages} projectId="project" runId="run" />);
    expect(view.container.querySelectorAll('button[title]')).toHaveLength(100);
    fireEvent.click(screen.getByText(label('showMoreUrls', { count: 1, remaining: 1 })));
    expect(view.container.querySelectorAll('button[title]')).toHaveLength(101);
    fireEvent.click(screen.getByTitle(pages[0].url));
    expect((screen.getByTitle(pages[0].url) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(view.container.querySelector('summary')!);
    expect(view.container.querySelectorAll('button[title]')).toHaveLength(0);
    fireEvent.click(view.container.querySelector('summary')!);
    expect(view.container.querySelectorAll('button[title]')).toHaveLength(101);
    expect(JSON.parse(localStorage.getItem(key('project'))!).visibleCounts).toEqual({ 'origin:https://site.test:pages': 200 });
  });

  it('paginates wide sibling folders and opens a previously collapsed directory', () => {
    const pages = Array.from({ length: 101 }, (_, i) => page({ url: `https://site.test/folder-${String(i).padStart(3, '0')}` }));
    const view = render(<CrawlDirectoryTree pages={pages} projectId="project" runId="run" />);
    expect(view.container.querySelectorAll('summary')).toHaveLength(101);
    fireEvent.click(screen.getByText(label('showMoreFolders', { count: 1, remaining: 1 })));
    expect(view.container.querySelectorAll('summary')).toHaveLength(102);
    fireEvent.click(screen.getByTitle('folder-100'));
    expect(screen.getByTitle(pages[100].url)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(key('project'))!).visibleCounts).toEqual({ 'origin:https://site.test:directories': 200 });
  });

  it('discloses invalid URLs and request failures and keeps unavailable timing distinct from zero', () => {
    const pages = [page({ url: 'not a URL' }), page({ url: 'https://site.test/', title: '', http_status: 0, request_error_kind: 'timeout', response_time_ms: -1, issues: [{ severity: 'Critical', message: 'failure' }] })];
    const view = render(<CrawlDirectoryTree pages={pages} projectId={null} runId="run" />);
    expect(screen.getByRole('status').textContent).toBe(label('ignored', { count: 1 }));
    expect(view.container.textContent).toContain('— /');
    expect(screen.getByTitle(pages[1].url).textContent).toContain('timeout');
    fireEvent.change(screen.getByLabelText(label('filterAria')), { target: { value: 'no match' } });
    expect(screen.getByText(label('noPages'))).toBeTruthy();
    expect(view.container.querySelector('aside')?.textContent).toBe(label('selectedPageHint'));
  });

  it('distinguishes issue styling, legacy missing issues and an observed lack of HTTP response', () => {
    const pages = [
      page({ url: 'https://site.test/?critical', issues: [{ severity: 'Critical', message: 'critical' }] }),
      page({ url: 'https://site.test/?warning', issues: [{ severity: 'Warning', message: 'warning' }] }),
      page({ url: 'https://site.test/?info', issues: [{ severity: 'Info', message: 'info' }] }),
      page({ url: 'https://site.test/?none', http_status: 0, issues: undefined }),
    ];
    const view = render(<CrawlDirectoryTree pages={pages} projectId={null} runId="run" />);
    for (const index of [0, 1]) expect(screen.getByTitle(pages[index].url).querySelector('span.border-amber-500\\/25')).toBeTruthy();
    expect(screen.getByTitle(pages[2].url).querySelector('span.border-slate-800')).toBeTruthy();
    expect(screen.getByTitle(pages[3].url).textContent).toContain(label('noResponse'));
    fireEvent.click(screen.getByTitle(pages[3].url));
    expect(view.container.querySelector('aside')?.textContent).toContain(label('noResponse'));
  });
});
