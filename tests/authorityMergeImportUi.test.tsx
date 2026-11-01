import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { TaxonomyMergePreview } from '@/components/Domain/crawlResults/authority/TaxonomyMergePreview';
import { ReferenceMapPanel } from '@/components/Domain/crawlResults/authority/ReferenceMapPanel';
import { useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import { importPreviewPillars, previewTaxonomyMerge } from '@/services/topicalAuthority';
import { createEmptyTopicalMap, createTopicalNode, readTopicalMap, writeTopicalMap } from '@/services/topicalMap';
import { readRefreshState } from '@/services/topicalAuthorityMonitoring';
import * as storage from '@/services/storage';
import { OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const tax = () => referenceTaxonomy(pages)!;
const IDLE = { running: false, progress: null, failure: null, error: null };
const pillarDoc = (titles: string[]) => ({ ...createEmptyTopicalMap(), nodes: titles.map((title) => ({ ...createTopicalNode(title), kind: 'pillar' as const })) });
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('importPreviewPillars (#57 GEM-57-06, #60)', () => {
  it('adds only missing reference pillars, never edits hand-made nodes, and respects the node cap', () => {
    const taxonomy = tax();
    const first = taxonomy.pillars[0];
    const doc = pillarDoc([first.label.toUpperCase()]);
    const preview = previewTaxonomyMerge(taxonomy, [first.label]);
    const next = importPreviewPillars(doc, { ...preview, added: [...preview.added, { pillarId: first.id, label: first.label, subtopics: 1 }] }, taxonomy);
    expect(next.nodes[0]).toBe(doc.nodes[0]);
    expect(next.nodes.map((node) => node.title.toLowerCase())).not.toContain(undefined);
    expect(next.nodes.length).toBe(1 + preview.added.length);
    expect(next.nodes.slice(1).every((node) => node.kind === 'pillar' && node.evidenceTerms.length > 0)).toBe(true);
    const full = { ...doc, nodes: Array.from({ length: 300 }, (_, i) => ({ ...createTopicalNode(`n${i}`) })) };
    expect(importPreviewPillars(full, preview, taxonomy).nodes).toHaveLength(300);
  });
});

describe('TaxonomyMergePreview', () => {
  it('renders nothing without a project', () => {
    const { container } = render(<TaxonomyMergePreview taxonomy={tax()} projectId={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('previews without writing, then adds pillars on an explicit click', () => {
    const taxonomy = tax();
    writeTopicalMap('mp', pillarDoc([taxonomy.pillars[0].label, 'Hand made only']));
    const before = JSON.stringify(readTopicalMap('mp').nodes);
    render(<TaxonomyMergePreview taxonomy={taxonomy} projectId="mp" />);
    expect(JSON.stringify(readTopicalMap('mp').nodes)).toBe(before);
    expect(document.body.textContent).toContain('Hand made only');
    fireEvent.click(screen.getByRole('button', { name: /Add \d+ reference pillars/ }));
    expect(screen.getByRole('status').textContent).toMatch(/Added \d+ pillars/);
    expect(readTopicalMap('mp').nodes.map((node) => node.title)).toContain('Hand made only');
    expect(readTopicalMap('mp').nodes.length).toBeGreaterThan(2);
  });

  it('disables the button when nothing is missing and reports write failures', () => {
    const taxonomy = tax();
    writeTopicalMap('all', pillarDoc(taxonomy.pillars.map((pillar) => pillar.label)));
    const { unmount } = render(<TaxonomyMergePreview taxonomy={taxonomy} projectId="all" />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    unmount();
    writeTopicalMap('fail', pillarDoc([]));
    vi.spyOn(storage, 'writeStorage').mockReturnValue(false);
    render(<TaxonomyMergePreview taxonomy={taxonomy} projectId="fail" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('status').textContent).toMatch(/Could not update the topical map/);
  });

  it('stringifies non-Error failures', () => {
    const taxonomy = tax();
    writeTopicalMap('odd', pillarDoc([]));
    vi.spyOn(storage, 'writeStorage').mockImplementation(() => { throw 'boom'; });
    render(<TaxonomyMergePreview taxonomy={taxonomy} projectId="odd" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('status').textContent).toMatch(/boom/);
  });
});

describe('auto-refresh opt-in', () => {
  it('shows the opt-in only when wired and passes the choice up; merge preview needs a map', () => {
    const onAutoRefresh = vi.fn();
    const { rerender } = render(<ReferenceMapPanel taxonomy={null} state={IDLE} onBuild={vi.fn()} onCancel={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByText(/automatically after scheduled crawls/)).toBeNull();
    rerender(<ReferenceMapPanel taxonomy={tax()} projectId="ar" state={IDLE} onBuild={vi.fn()} onCancel={vi.fn()} onClear={vi.fn()} autoRefresh={false} onAutoRefresh={onAutoRefresh} />);
    fireEvent.click(screen.getByLabelText(/automatically after scheduled crawls/));
    expect(onAutoRefresh).toHaveBeenCalledWith(true);
  });

  it('persists the hook setting per project and ignores failed writes', () => {
    const sfs = ownReport(pages);
    const hook = renderHook(() => useTopicalAuthority({ pages, startUrl: `https://${OWN_HOST}/`, sfs, projectId: 'ar2' }));
    expect(hook.result.current.autoRefresh).toBe(false);
    act(() => hook.result.current.setAutoRefresh(true));
    expect(hook.result.current.autoRefresh).toBe(true);
    expect(readRefreshState('ar2').enabled).toBe(true);
    hook.rerender();
    const none = renderHook(() => useTopicalAuthority({ pages, startUrl: `https://${OWN_HOST}/`, sfs, projectId: null }));
    act(() => none.result.current.setAutoRefresh(true));
    expect(none.result.current.autoRefresh).toBe(false);
  });
});
