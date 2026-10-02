import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BriefHandoff } from '@/components/Charts/contentBrief/BriefHandoff';
import { copyText } from '@/services/clipboard';
import { downloadText } from '@/services/export';
import { briefLabel as label, briefModel } from './fixtures/briefUiContracts';

vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
vi.mock('@/services/export', () => ({ downloadText: vi.fn() }));
afterEach(() => vi.useRealTimers());

describe('brief local handoff controls', () => {
  it('exports declared Unicode titles and data in both formats with a blank-title fallback', () => {
    const model = briefModel();
    model.node.title = ' Żółta Kawa! ';
    const view = render(<BriefHandoff model={model} />);
    fireEvent.click(screen.getByRole('button', { name: label('downloadMarkdown') }));
    expect(downloadText).toHaveBeenLastCalledWith('seomi-żółta-kawa-brief.md', expect.stringContaining('# Żółta Kawa!'), 'text/markdown');
    fireEvent.click(screen.getByRole('button', { name: label('downloadJson') }));
    const [filename, data, mime] = vi.mocked(downloadText).mock.calls.at(-1)!;
    expect(filename).toBe('seomi-żółta-kawa-brief.json');
    expect(mime).toBe('application/json');
    expect(JSON.parse(data as string)).toMatchObject({ schemaVersion: 1, brief: model.brief, node: { id: model.node.id } });
    model.node.title = '!';
    view.rerender(<BriefHandoff model={model} />);
    fireEvent.click(screen.getByRole('button', { name: label('downloadMarkdown') }));
    expect(downloadText).toHaveBeenLastCalledWith('seomi-brief-brief.md', expect.any(String), 'text/markdown');
    fireEvent.click(screen.getByRole('button', { name: label('downloadJson') }));
    expect(downloadText).toHaveBeenLastCalledWith('seomi-brief-brief.json', expect.any(String), 'application/json');
  });

  it('keeps failed copies idle and restarts exactly one feedback timer after repeated successful copies', async () => {
    vi.useFakeTimers();
    vi.mocked(copyText).mockResolvedValueOnce(false).mockResolvedValue(true);
    render(<BriefHandoff model={briefModel()} />);
    const button = screen.getByRole('button', { name: label('copyMarkdown') });
    await act(async () => { fireEvent.click(button); });
    expect(button.textContent).toBe(label('copyMarkdown'));
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { fireEvent.click(button); });
    expect(button.textContent).toBe(label('copied'));
    act(() => vi.advanceTimersByTime(1000));
    await act(async () => { fireEvent.click(button); });
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(button.textContent).toBe(label('copied'));
    act(() => vi.advanceTimersByTime(500));
    expect(button.textContent).toBe(label('copyMarkdown'));
    expect(vi.getTimerCount()).toBe(0);
  });
});
