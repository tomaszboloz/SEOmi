import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCrawlEvidenceRouting } from '@/components/Domain/crawlResults/session/useCrawlEvidenceRouting';
import { useProjectStore } from '@/stores/projectStore';

const mkFilter = (linkEvidence: { source: string; target: string } | null = null) => ({
  setLinkQuery: vi.fn(), setLinkKind: vi.fn(), setLinkStatus: vi.fn(), setLinkEvidence: vi.fn(), setSeverity: vi.fn(), setErrorKind: vi.fn(),
  setSegment: vi.fn(), setOnlyProblems: vi.fn(), setQuery: vi.fn(), setEvidenceUrl: vi.fn(), linkEvidence,
});
const runs = [{ id: 'r1' }] as never;
const mount = (over: Record<string, unknown> = {}) => {
  const filterState = mkFilter();
  const tabNav = { activeTab: 'overview', setActiveTab: vi.fn() };
  const onSelectRun = vi.fn();
  const view = renderHook((p: Record<string, unknown>) => useCrawlEvidenceRouting({ activeProjectId: 'p1', runs, onSelectRun, tabNav, filterState, navigationRunId: 'r1', pages: [], ...p } as never), { initialProps: over });
  return { filterState, tabNav, onSelectRun, view };
};
const hash = (q: string) => { window.location.hash = q; };

describe('useCrawlEvidenceRouting', () => {
  beforeEach(() => {
    window.location.hash = '';
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('ignores unrelated hashes and incomplete evidence links', () => {
    const m = mount();
    for (const h of ['#other', '#crawl-evidence?project=p1&run=r1', '#crawl-evidence?run=r1&url=x', '#crawl-evidence?project=p1&url=x']) {
      hash(h); act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    }
    expect(m.tabNav.setActiveTab).not.toHaveBeenCalled();
    expect(m.onSelectRun).not.toHaveBeenCalled();
  });

  it('switches to a known project but ignores unknown ones', () => {
    const select = vi.fn();
    useProjectStore.setState({ projects: [{ id: 'p2' }], selectProject: select } as never);
    hash('#crawl-evidence?project=p2&run=r1&url=u');
    const m = mount();
    expect(select).toHaveBeenCalledWith('p2');
    hash('#crawl-evidence?project=zzz&run=r1&url=u');
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(select).toHaveBeenCalledTimes(1);
    expect(m.onSelectRun).not.toHaveBeenCalled();
  });

  it('ignores a run missing from the project', () => {
    hash('#crawl-evidence?project=p1&run=missing&url=u');
    const m = mount();
    expect(m.tabNav.setActiveTab).not.toHaveBeenCalled();
  });

  it('opens URL evidence, resets filters and scrolls to the row', () => {
    const row = document.createElement('tr');
    row.id = `crawl-row-${encodeURIComponent('https://a.test/x')}`;
    row.scrollIntoView = vi.fn();
    document.body.append(row);
    hash(`#crawl-evidence?project=p1&run=r1&url=${encodeURIComponent('https://a.test/x')}`);
    const m = mount();
    expect(m.tabNav.setActiveTab).toHaveBeenCalledWith('urls');
    expect(m.filterState.setQuery).toHaveBeenCalledWith('https://a.test/x');
    expect(m.filterState.setEvidenceUrl).toHaveBeenCalledWith('https://a.test/x');
    expect(m.filterState.setSeverity).toHaveBeenCalledWith('all');
    expect(m.filterState.setOnlyProblems).toHaveBeenCalledWith(false);
    expect(m.onSelectRun).toHaveBeenCalledWith('r1');
    expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('opens link evidence only when source and target exist, and stops listening on unmount', () => {
    hash('#crawl-evidence?project=p1&run=r1&url=u&tab=links&source=s&target=t');
    const m = mount();
    expect(m.tabNav.setActiveTab).toHaveBeenCalledWith('links');
    expect(m.filterState.setLinkEvidence).toHaveBeenCalledWith({ source: 's', target: 't' });
    expect(m.filterState.setLinkKind).toHaveBeenCalledWith('all');
    expect(m.filterState.setQuery).not.toHaveBeenCalled();
    hash('#crawl-evidence?project=p1&run=r1&url=u&tab=links&source=s');
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(m.tabNav.setActiveTab).toHaveBeenLastCalledWith('urls');
    m.view.unmount();
    const calls = m.onSelectRun.mock.calls.length;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(m.onSelectRun.mock.calls.length).toBe(calls);
  });

  it('scrolls the matching link row when the links tab has evidence', () => {
    const mk = (s: string, t: string) => { const e = document.createElement('tr'); e.dataset.crawlLinkRow = ''; e.dataset.sourceUrl = s; e.dataset.targetUrl = t; e.scrollIntoView = vi.fn(); document.body.append(e); return e; };
    const other = mk('s', 'x'); const match = mk('s', 't');
    const m = mount();
    m.view.rerender({});
    const tabNav = { activeTab: 'links', setActiveTab: vi.fn() };
    const view = renderHook(() => useCrawlEvidenceRouting({ activeProjectId: 'p1', runs, onSelectRun: vi.fn(), tabNav, filterState: mkFilter({ source: 's', target: 't' }), navigationRunId: 'r1', pages: [] } as never));
    expect(match.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(other.scrollIntoView).not.toHaveBeenCalled();
    view.unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('does not scroll on other tabs or without evidence', () => {
    const row = document.createElement('tr'); row.dataset.crawlLinkRow = ''; row.scrollIntoView = vi.fn(); document.body.append(row);
    renderHook(() => useCrawlEvidenceRouting({ activeProjectId: 'p1', runs, onSelectRun: vi.fn(), tabNav: { activeTab: 'links', setActiveTab: vi.fn() }, filterState: mkFilter(null), navigationRunId: 'r', pages: [] } as never));
    renderHook(() => useCrawlEvidenceRouting({ activeProjectId: 'p1', runs, onSelectRun: vi.fn(), tabNav: { activeTab: 'urls', setActiveTab: vi.fn() }, filterState: mkFilter({ source: 's', target: 't' }), navigationRunId: 'r', pages: [] } as never));
    expect(row.scrollIntoView).not.toHaveBeenCalled();
  });
});
