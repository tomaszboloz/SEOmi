import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { EntityParityPanel } from '@/components/Charts/EntityParityPanel';
import { useEntityLinks } from '@/components/Charts/semanticTopical/signals/useEntityLinks';
import { languageTopics } from '@/components/Charts/semanticTopical/signals/parityAdapter';
import type { WikidataLookup } from '@/services/entityIds';

const topics = [{ language: 'pl', topic: 'c1', label: 'Espresso' }, { language: 'de', topic: 'c2', label: 'Kaffee' }];
const hit = (id: string, label: string): WikidataLookup => ({ status: 'ok', candidates: [{ id, label, description: '' }], fetchedAt: new Date().toISOString() });
beforeEach(() => localStorage.clear());

describe('useEntityLinks (#99)', () => {
  it('looks up on demand, caches per project, reports gaps and applies corrections', async () => {
    const lookup = vi.fn(async (label: string) => (label === 'Espresso' ? hit('Q1', 'espresso') : hit('Q2', 'Kaffee')));
    const view = renderHook(({ project }) => useEntityLinks(project, topics, lookup), { initialProps: { project: 'p1' as string | null } });
    expect(view.result.current.pending).toBe(2);
    expect(lookup).not.toHaveBeenCalled();
    await act(async () => { await view.result.current.match(); });
    expect(view.result.current.pending).toBe(0);
    expect(view.result.current.gaps.map((gap) => [gap.qid, gap.missingIn])).toEqual([['Q1', ['de']], ['Q2', ['pl']]]);
    act(() => view.result.current.correct(topics[1], 'q1'));
    expect(view.result.current.gaps).toEqual([]);
    act(() => view.result.current.correct(topics[1], ''));
    expect(view.result.current.gaps).toHaveLength(2);
    view.rerender({ project: 'p2' });
    expect(view.result.current.pending).toBe(2);
    view.rerender({ project: 'p1' });
    expect(view.result.current.pending).toBe(0);
    view.rerender({ project: null });
    await act(async () => { await view.result.current.match(); });
    expect(view.result.current.links.every((link) => link.qid)).toBe(true);
  });

  it('drops results of a run started for another project', async () => {
    let release: (value: WikidataLookup) => void = () => undefined;
    const lookup = vi.fn(() => new Promise<WikidataLookup>((resolve) => { release = resolve; }));
    const view = renderHook(({ project }) => useEntityLinks(project, topics, lookup), { initialProps: { project: 'a' } });
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = view.result.current.match(); });
    view.rerender({ project: 'b' });
    await act(async () => { release(hit('Q1', 'espresso')); await pending; });
    expect(view.result.current.pending).toBe(2);
    expect(view.result.current.running).toBe(false);
  });
});

describe('EntityParityPanel', () => {
  it('shows gaps, failures, review flags and keyboard-editable corrections', () => {
    const onMatch = vi.fn();
    const onCorrect = vi.fn();
    const links = [
      { ...topics[0], qid: 'Q1', confidence: 'search' as const },
      { ...topics[1], qid: null, confidence: 'error' as const },
    ];
    const view = render(<EntityParityPanel links={links} gaps={[{ qid: 'Q1', label: 'espresso', presentIn: ['pl'], missingIn: ['de'], reviewed: false }]} pending={1} running={false} onMatch={onMatch} onCorrect={onCorrect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Match 1 topics with Wikidata' }));
    expect(onMatch).toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/did not answer for 1/);
    expect(screen.getByText(/present in pl, missing in de/)).toBeTruthy();
    expect(screen.getByText('search match, review')).toBeTruthy();
    const input = screen.getByRole('textbox', { name: /Wikidata ID for Kaffee \(de\)/ });
    fireEvent.blur(input, { target: { value: 'Q1' } });
    expect(onCorrect).toHaveBeenCalledWith(links[1], 'Q1');
    view.rerender(<EntityParityPanel links={[{ ...topics[0], qid: 'Q1', confidence: 'manual' }]} gaps={[]} pending={0} running onMatch={onMatch} />);
    expect(screen.getByRole('button', { name: 'Matching with Wikidata…' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('status').textContent).toMatch(/Every matched entity/);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('languageTopics', () => {
  it('lists labelled topics per language from hreflang clusters', () => {
    const page = (url: string, lang: string, alt: string, altLang: string) => ({ url, document_language: lang, word_count: 300, hreflangs: [{ language: lang, target_url: url }, { language: altLang, target_url: alt }] });
    const pages = [page('https://x.test/pl/', 'pl', 'https://x.test/de/', 'de'), page('https://x.test/de/', 'de', 'https://x.test/pl/', 'pl')];
    const graph = { nodes: [{ page: { url: 'https://x.test/pl/' }, clusterId: 'c1', clusterLabel: 'Espresso' }, { page: { url: 'https://x.test/de/' }, clusterId: 'c2', clusterLabel: '' }], truncated: false };
    expect(languageTopics(pages as never, graph as never)).toEqual([{ language: 'pl', topic: 'c1', label: 'Espresso' }]);
  });
});
