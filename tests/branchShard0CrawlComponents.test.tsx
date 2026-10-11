import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { CrawlHreflangList } from '@/components/Domain/crawlResults/internationalTab/CrawlHreflangList';
import { CrawlMediaResourcesSection } from '@/components/Domain/crawlResults/mediaTab/CrawlMediaResourcesSection';
import { CrawlPageTableRow } from '@/components/Domain/crawlResults/pageTable/CrawlPageTableRow';
import { CrawlHistoryMetricsSection } from '@/components/Domain/crawlResults/visualisationsTab/CrawlHistoryMetricsSection';
import { ScheduledAuditForm } from '@/components/Domain/scheduledAudits/ScheduledAuditForm';
import { CrawlRenderOptions } from '@/components/Domain/siteAudit/CrawlRenderOptions';
import { CrawlPageErrorSummaryRow } from '@/components/Domain/siteAudit/pageErrors/CrawlPageErrorSummaryRow';
import { useCrawlFormState } from '@/components/Domain/siteAudit/session/useCrawlFormState';
import { useToolsStore } from '@/stores/toolsStore';
import type { CrawledHreflang } from '@/types';
import { createCrawlPageFixture } from './fixtures/crawl';

const t = ((key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key)) as unknown as TFunction;
const plainT = (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CrawlHreflangList', () => {
  const hreflang = (patch: Partial<CrawledHreflang>): CrawledHreflang => ({
    language: 'de', target_url: 'https://ex.test/de', target_checked_in_run: true, target_http_status: 200, reciprocal_in_run: true,
    ...patch,
  } as CrawledHreflang);

  it('shows the no-response label, a missing reciprocal and the out-of-run canonical fallback', () => {
    const { container } = render(<CrawlHreflangList t={t} hreflangs={[hreflang({ target_http_status: null, reciprocal_in_run: false, target_canonical_alignment: undefined })]} />);
    const detail = container.querySelector('span.block')!.textContent!;
    expect(detail).toContain('crawl.ui.httpStatus:{"status":"crawlDeepUi.noResponse"}');
    expect(detail).toContain('crawlDeepUi.noReciprocal');
    expect(detail).toContain('crawlDeepUi.canonicalOutsideRun');
  });

  it('distinguishes confirmed reciprocity, unchecked reciprocity and targets outside the run', () => {
    const { container } = render(<CrawlHreflangList t={t} hreflangs={[
      hreflang({ language: 'de' }),
      hreflang({ language: 'fr', target_url: 'https://ex.test/fr', reciprocal_in_run: null, target_checked_in_run: false, target_canonical_alignment: 'self' }),
    ] as CrawledHreflang[]} />);
    const details = [...container.querySelectorAll('span.block')].map((node) => node.textContent);
    expect(details[0]).toContain('crawlDeepUi.yes');
    expect(details[1]).toContain('crawlDeepUi.statusOutsideRun');
    expect(details[1]).toContain('crawlDeepUi.reciprocityUnchecked');
    expect(details[1]).toContain('self');
  });
});

describe('CrawlMediaResourcesSection empty states', () => {
  const row = { resource: { url: 'https://ex.test/a.png' }, status: 'verified', sourceUrls: [], knownSourceUrls: [] };
  const show = (inventory: unknown[]) => render(<CrawlMediaResourcesSection
    resourceInventory={inventory as never} visibleResourceInventory={[]} filter={'all' as never} onFilterChange={() => undefined} t={t} />);

  it('explains that the filter hides every resource when the inventory is not empty', () => {
    show([row]);
    expect(screen.getByText('crawl.ui.noResourcesForFilter')).toBeTruthy();
    expect(screen.queryByText('crawl.ui.noAdditionalResources')).toBeNull();
  });

  it('reports no additional resources for an empty inventory', () => {
    show([]);
    expect(screen.getByText('crawl.ui.noAdditionalResources')).toBeTruthy();
  });
});

describe('CrawlPageTableRow fallbacks', () => {
  const show = (patch: Parameters<typeof createCrawlPageFixture>[0]) => {
    const view = render(<table><tbody><CrawlPageTableRow page={createCrawlPageFixture(patch)} evidenceUrl={null} evidenceHref={(url) => url} hasRun={false} t={t} /></tbody></table>);
    return view.container.querySelector('tr')!;
  };

  it('shows a dash when a page has neither status nor transport error', () => {
    const row = show({ http_status: 0, request_error_kind: null });
    expect(row.querySelector('td span')!.textContent).toBe('—');
    expect(row.querySelector('td span')!.getAttribute('title')).toBeNull();
  });

  it('omits the formula from the readability tooltip when the method is unknown', () => {
    const row = show({ readability_grade: 9.46, readability_method: undefined, readability_ease_score: 60 });
    const cellWithTitle = [...row.querySelectorAll('td')].find((cell) => cell.getAttribute('title')?.startsWith('crawl.ui.grade'))!;
    expect(cellWithTitle.getAttribute('title')).toBe('crawl.ui.grade 9.5');
  });
});

describe('CrawlHistoryMetricsSection', () => {
  it('prints a dash when the latest saved value is missing', () => {
    render(<CrawlHistoryMetricsSection runsCount={2} t={plainT} historyMetrics={[
      { label: 'Latest missing', colour: 'text-sky-300', values: [4, null] },
      { label: 'Latest present', colour: 'text-sky-300', values: [null, 7] },
    ]} />);
    const value = (label: string) => screen.getByText(label).nextElementSibling!.textContent;
    expect(value('Latest missing')).toBe('—');
    expect(value('Latest present')).toBe('7');
  });
});

describe('ScheduledAuditForm crawl limit', () => {
  it.each([['0', 1], ['', 1], ['abc', 1], ['9999', 500], ['42', 42]])('normalizes %j to %i', (typed, expected) => {
    const setLimit = vi.fn();
    render(<ScheduledAuditForm url="" setUrl={vi.fn()} taskType="site-crawl" setTaskType={vi.fn()} intervalHours={24 as never}
      setIntervalHours={vi.fn()} scheduledCrawlLimit={10} setScheduledCrawlLimit={setLimit} isTauri schedulesCount={0} onSubmit={vi.fn()} t={plainT} />);
    fireEvent.change(screen.getByLabelText('schedules.crawlLimit'), { target: { value: typed } });
    expect(setLimit).toHaveBeenCalledWith(expected);
  });
});

describe('CrawlRenderOptions defaults', () => {
  it('renders zero for unset wait delay and lazy-scroll cycles', () => {
    const session = { crawlConfig: {}, renderedProfileHasTransportOverrides: false, setCrawlConfig: vi.fn(), t: plainT } as never;
    render(<CrawlRenderOptions session={session} />);
    expect((screen.getByLabelText('siteAudit.renderDelayAria') as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText('siteAudit.lazyScrollAria') as HTMLInputElement).value).toBe('0');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('CrawlPageErrorSummaryRow', () => {
  it('uses the success badge style for pages without issues and the error style otherwise', () => {
    const show = (issues: Array<{ severity: 'Warning'; message: string }>) => render(
      <table><tbody><CrawlPageErrorSummaryRow page={createCrawlPageFixture({ issues })} isExpanded={false} onToggle={vi.fn()} t={t} /></tbody></table>,
    );
    const clean = show([]);
    const badge = (container: HTMLElement) => container.querySelectorAll('span')[1] as HTMLElement;
    expect(badge(clean.container).className).toContain('text-emerald-400');
    clean.unmount();
    const dirty = show([{ severity: 'Warning', message: 'x' }]);
    expect(badge(dirty.container).className).toContain('text-rose-400');
  });
});

describe('useCrawlFormState custom search ids', () => {
  const originalTools = useToolsStore.getState();
  beforeEach(() => { act(() => { useToolsStore.setState({ crawlConfig: { ...originalTools.crawlConfig, customSearches: [] } }); }); });
  afterEach(() => { act(() => { useToolsStore.setState(originalTools); }); });

  it('falls back to a timestamp id when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    const { result } = renderHook(() => useCrawlFormState('shard0-project', {} as never));
    act(() => { result.current.addCustomSearch(); });
    const [search] = useToolsStore.getState().crawlConfig.customSearches ?? [];
    expect(search.id).toMatch(/^custom-search-\d+$/);
  });
});
