import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));

import { SegmentsPanel } from '@/components/Domain/crawlResults/focus/SegmentsPanel';
import { useSiteFocus } from '@/hooks/useSiteFocus';
import { cleanSegments, type SegmentFocus } from '@/services/siteFocus';
import { TEAM_CONTEXT_KEY } from '@/services/team/identity';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { multiTopicSite } from './siteFocusFixtures';

const as = (role: string) => localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor: 'tester', role }));
const LABEL = 'Segments (one per line: Label | /path-prefix | optional topic)';
const result = (patch: Partial<SegmentFocus> = {}): SegmentFocus => ({
  label: 'Tech', pathPrefix: '/electronics', source: 'user', pageCount: 10, scoredCount: 9, score: 81.5, band: 'good', coreLabel: 'laptop, monitor', coreMode: 'anchored', ...patch,
});

beforeEach(() => { localStorage.clear(); as('seo_strategist'); });
afterEach(cleanup);

describe('SegmentsPanel (#82 GEM-82-05)', () => {
  it('saves parsed segments, reports dropped lines and shows scores, including unavailable ones', () => {
    const save = vi.fn(cleanSegments);
    render(<SegmentsPanel results={[result(), result({ label: 'Ghost', pathPrefix: '/missing', score: null, band: 'unavailable' })]} saved={[]} persisted onSave={save} />);
    fireEvent.change(screen.getByLabelText(LABEL), { target: { value: 'Tech | /electronics/\nnot a segment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save segments' }));
    expect(save).toHaveBeenLastCalledWith([{ label: 'Tech', pathPrefix: '/electronics' }]);
    expect(screen.getByRole('alert').textContent).toContain('1 line(s) were not valid');
    expect((screen.getByLabelText(LABEL) as HTMLTextAreaElement).value).toBe('Tech | /electronics');
    const items = screen.getByTestId('focus-segment-results').textContent ?? '';
    expect(items).toContain('Tech (/electronics): 81.5, Good focus. Core: laptop, monitor. Scored pages: 9 of 10.');
    expect(items).toContain('Ghost (/missing): no scored page under this prefix, so there is no score (not 0).');
  });

  it('is read-only without a project or without permission', () => {
    const save = vi.fn(cleanSegments);
    const { unmount } = render(<SegmentsPanel results={undefined} saved={[]} persisted={false} onSave={save} />);
    expect(screen.getByText('Segments are saved per project. Open this crawl from a project to set them.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save segments' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('focus-segment-results')).toBeNull();
    unmount();
    as('content_writer');
    render(<SegmentsPanel results={[]} saved={[]} persisted onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save segments' }));
    expect(save).not.toHaveBeenCalled();
  });
});

describe('useSiteFocus segments', () => {
  it('saves segments per project and rebuilds the report with segment scores', () => {
    const run = createCrawlRunFixture({ id: 'run-seg', startUrl: 'https://shop.test/', result: createCrawlResultFixture({ pages: multiTopicSite() }) });
    const { result: hook } = renderHook(() => useSiteFocus(run, 'proj-seg'));
    expect(hook.current.report?.segments).toBeUndefined();
    act(() => { hook.current.setSegments([{ label: 'Wear', pathPrefix: '/fashion' }]); });
    expect(hook.current.segments).toEqual([{ label: 'Wear', pathPrefix: '/fashion' }]);
    expect(hook.current.report?.segments?.[0]).toMatchObject({ pathPrefix: '/fashion', pageCount: 10 });
    const { result: other } = renderHook(() => useSiteFocus(run, 'proj-other'));
    expect(other.current.segments).toEqual([]);
  });
});
