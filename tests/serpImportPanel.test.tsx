import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { EmbeddingClusteringPanel } from '@/components/Keywords/embeddingClustering/EmbeddingClusteringPanel';
import { SerpImportPanel } from '@/components/Keywords/embeddingClustering/SerpImportPanel';
import type { ImportedSerp } from '@/components/Keywords/embeddingClustering/importedSerpStorage';
import type { SerpSource } from '@/services/serpImport';

const source = (overrides: Partial<SerpSource> = {}): SerpSource => ({
  kind: 'json-import', provider: null, sourceUrl: null, countryCode: null, locationCode: null,
  languageCode: null, capturedAt: null, retrievedAt: null, availability: 'missing', reason: null, ...overrides,
});
const draft = (overrides: Partial<SerpSource> = {}): ImportedSerp => {
  const evidence = source(overrides);
  return { payload: '{}', format: 'json', importedAt: '2026-10-06T12:00:00.000Z', result: {
    source: evidence, records: [], rejected: [], duplicateCount: 0, excludedOutsideTop10: 0,
    snapshots: [{ keyword: 'seo', rows: [{ rank: 1, url: 'https://example.test' }], urls: ['https://example.test'], source: evidence }],
  } };
};

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('SERP import panel contracts', () => {
  it('keeps actions disabled until a project and payload exist, then sends format and payload', () => {
    const onImport = vi.fn(); const onClear = vi.fn();
    const props = { imported: null, error: null, onImport, onClear };
    const { rerender } = render(<SerpImportPanel projectId={null} {...props} />);
    const importButton = screen.getByRole('button', { name: 'Import SERP' }) as HTMLButtonElement;
    const clearButton = screen.getByRole('button', { name: 'Remove import' }) as HTMLButtonElement;
    const textarea = screen.getByLabelText('Observed SERP data') as HTMLTextAreaElement;
    expect(importButton.disabled).toBe(true); expect(clearButton.disabled).toBe(true);
    fireEvent.change(textarea, { target: { value: 'keyword,rank,url\nseo,1,https://example.test' } });
    expect(importButton.disabled).toBe(true);
    rerender(<SerpImportPanel projectId="p1" {...props} />);
    expect(importButton.disabled).toBe(false);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'csv' } });
    fireEvent.click(importButton);
    expect(onImport).toHaveBeenCalledWith('keyword,rank,url\nseo,1,https://example.test', 'csv');
    rerender(<SerpImportPanel projectId="p1" {...props} imported={draft()} />);
    expect(clearButton.disabled).toBe(false); fireEvent.click(clearButton); expect(onClear).toHaveBeenCalledOnce();
  });

  it('renders real and unknown provenance and exposes import errors', () => {
    const props = { projectId: 'p1', imported: draft(), onImport: vi.fn(), onClear: vi.fn() };
    const { rerender } = render(<SerpImportPanel {...props} error="Import failed" />);
    expect(screen.getByText('Source: Unknown · missing')).toBeTruthy();
    expect(screen.getByText('Market: Unknown · language: Unknown')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Import failed');
    rerender(<SerpImportPanel {...props} imported={draft({ provider: 'Google', countryCode: 'PL', languageCode: 'pl', availability: 'complete', capturedAt: '2026-10-06T10:00:00.000Z' })} error={null} />);
    expect(screen.getByText('Source: Google · complete')).toBeTruthy();
    expect(screen.getByText('Market: PL · language: pl')).toBeTruthy();
  });

  it('resets the local payload draft when the parent changes project key', () => {
    const { rerender } = render(<EmbeddingClusteringPanel projectId="p1" keywords={['one', 'two']} />);
    const textarea = screen.getByLabelText('Observed SERP data') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'project one draft' } });
    expect(textarea.value).toBe('project one draft');
    rerender(<EmbeddingClusteringPanel projectId="p2" keywords={['one', 'two']} />);
    expect((screen.getByLabelText('Observed SERP data') as HTMLTextAreaElement).value).toBe('');
  });
});
