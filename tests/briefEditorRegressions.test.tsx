import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentBriefEditor } from '@/components/Charts/ContentBriefEditor';
import { createTopicalNode } from '@/services/topicalMap';
import { copyText } from '@/services/clipboard';
import type { CrawledPageSummary } from '@/types';
import i18n from '@/i18n';

vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
const label = (key: string, values?: Record<string, unknown>) => i18n.t(`contentBrief.${key}`, values);
const props = () => ({ node: createTopicalNode('Coffee'), facts: [], pages: [], onUpdate: vi.fn(), onAdvance: vi.fn() });
afterEach(() => vi.useRealTimers());

describe('brief editor identity and lifecycle regressions', () => {
  it('renders legacy pages without a final URL and counts only available URL identities', () => {
    const input = props();
    const pages = [{ url: 'https://site.test/guide' }] as CrawledPageSummary[];
    render(<ContentBriefEditor {...input} pages={pages} />);
    expect(screen.getByLabelText(label('crawledUrlsAria', { count: 1 })).textContent).toBe('1');
  });

  it('marks fragment-equivalent saved internal links as checked and removes their identity', () => {
    const input = props();
    const url = 'https://site.test/guide';
    input.node.contentBrief.internalLinkTargets = [`${url}#part`];
    render(<ContentBriefEditor {...input} pages={[{ url, final_url: url }] as CrawledPageSummary[]} />);
    const checkbox = screen.getByRole('checkbox', { name: label('addInternal', { url }) }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(input.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ internalLinkTargets: [] }));
  });

  it('does not carry a checkpoint note or selected version into another topic', () => {
    const input = props();
    input.node.contentBrief.draftVersions = [{ id: 'shared-id', note: 'old', savedAt: '2026-10-01', draftMarkdown: 'old' }];
    const view = render(<ContentBriefEditor {...input} />);
    fireEvent.change(screen.getByLabelText(label('versionNoteAria')), { target: { value: 'For coffee only' } });
    fireEvent.change(screen.getByRole('combobox', { name: label('diffAria') }), { target: { value: 'shared-id' } });
    const next = createTopicalNode('Tea');
    next.contentBrief.draftVersions = [...input.node.contentBrief.draftVersions];
    view.rerender(<ContentBriefEditor {...input} node={next} />);
    expect((screen.getByLabelText(label('versionNoteAria')) as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('combobox', { name: label('diffAria') }) as HTMLSelectElement).value).toBe('');
  });

  it('does not show a stale clipboard result after switching topics', async () => {
    const input = props();
    let finish!: (result: boolean) => void;
    vi.mocked(copyText).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = render(<ContentBriefEditor {...input} />);
    fireEvent.click(screen.getByRole('button', { name: label('copyMarkdown') }));
    view.rerender(<ContentBriefEditor {...input} node={createTopicalNode('Tea')} />);
    await act(async () => { finish(true); });
    expect(screen.getByRole('button', { name: label('copyMarkdown') }).textContent).toBe(label('copyMarkdown'));
  });

  it('clears clipboard feedback timers when the editor is unmounted', async () => {
    vi.useFakeTimers();
    vi.mocked(copyText).mockResolvedValueOnce(true);
    const view = render(<ContentBriefEditor {...props()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: label('copyMarkdown') })); });
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
