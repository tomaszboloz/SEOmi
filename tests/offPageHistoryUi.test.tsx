import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { OffPageHistory } from '@/components/Domain/backlinkChecker/OffPageHistory';
import { OffPageHistoryDetails } from '@/components/Domain/backlinkChecker/OffPageHistoryDetails';
import { loadOffPageHistory, saveOffPageHistory } from '@/services/offPage/history';
import { downloadText } from '@/services/export/download';
import { historyRecord } from './fixtures/offPageHistory';

vi.mock('@/services/export/download', () => ({ downloadText: vi.fn() }));
beforeEach(async () => { localStorage.clear(); vi.mocked(downloadText).mockClear(); await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const current = historyRecord();
const older = historyRecord({ id: 'older', createdAt: '2026-10-23T10:00:00.000Z', tbva: { value: 0.5, status: 'ready', limitations: [] } });

it('has an empty project view and no history/export without an active project', () => {
  const view = render(<OffPageHistory projectId={null} current={null} saved />);
  expect(view.container.innerHTML).toBe('');
  view.rerender(<OffPageHistory projectId="p" current={null} saved />);
  expect(screen.getByText('No completed analyses saved.')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

it('restores newest-first history, compares TBVA, expands source rows and exports the selected snapshot', () => {
  saveOffPageHistory('p', older); saveOffPageHistory('p', current);
  const view = render(<OffPageHistory projectId="p" current={null} saved />);
  expect([...view.container.querySelectorAll('time')].map((node) => node.dateTime)).toEqual([current.createdAt, older.createdAt]);
  expect(screen.getByText('TBVA: 0.8 · Scored/requested: 1/1')).toBeTruthy();
  expect(screen.getByText('TBVA change: +0.3')).toBeTruthy();
  expect(screen.getByText('Not comparable: no previous record')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: 'View sources' })[0]);
  expect(screen.getByRole('table').textContent).toContain('https://source.test/page');
  expect(screen.getByText('Embedding: local-hash / hash-test')).toBeTruthy();
  expect(screen.getByText('Acme SEO')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Hide sources' }));
  expect(screen.queryByRole('table')).toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: 'Export record CSV' })[1]);
  expect(downloadText).toHaveBeenCalledWith('seomi-offpage-p-2026-10-23.csv', expect.stringContaining('"co_citation"'), 'text/csv');
  view.unmount(); render(<OffPageHistory projectId="p" current={null} saved />);
  expect(screen.getByText('TBVA change: +0.3')).toBeTruthy();
});

it.each([
  [{ scale: 10 }, 'different authority scale'],
  [{ embeddingModelId: 'other' }, 'different embedding model'],
  [{ embeddingModelId: null }, 'embedding model unknown'],
  [{ tbva: { value: null, status: 'unavailable' as const, limitations: [] } }, 'TBVA unavailable'],
])('explains non-comparable records %j', (overrides, reason) => {
  saveOffPageHistory('p', older); saveOffPageHistory('p', historyRecord(overrides));
  render(<OffPageHistory projectId="p" current={null} saved />);
  expect(screen.getByText(`Not comparable: ${reason}`)).toBeTruthy();
  expect(screen.queryByText(/TBVA change:/u)).toBeNull();
});

it('exports a completed current result even if storage failed, and refreshes after a successful save', () => {
  const view = render(<OffPageHistory projectId="p" current={current} saved={false} />);
  expect(screen.getByRole('alert').textContent).toContain('changes were not saved');
  fireEvent.click(screen.getByRole('button', { name: 'Export current CSV' }));
  expect(downloadText).toHaveBeenCalledWith('seomi-offpage-p-2026-10-24.csv', expect.stringContaining('"0.8"'), 'text/csv');
  const fresh = historyRecord({ id: 'fresh' }); saveOffPageHistory('p', fresh);
  view.rerender(<OffPageHistory projectId="p" current={fresh} saved />);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Delete record' })).toHaveLength(1);
});

it('deletes and clears only this project and does not expose selected rows after a project switch', () => {
  saveOffPageHistory('p', older); saveOffPageHistory('p', current); saveOffPageHistory('q', current);
  const view = render(<OffPageHistory key="p" projectId="p" current={null} saved />);
  fireEvent.click(screen.getAllByRole('button', { name: 'View sources' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete record' })[0]);
  expect(screen.queryByRole('table')).toBeNull();
  expect(loadOffPageHistory('p').map((record) => record.id)).toEqual(['older']);
  fireEvent.click(screen.getByRole('button', { name: 'Clear project history' }));
  expect(screen.getByText('No completed analyses saved.')).toBeTruthy();
  expect(loadOffPageHistory('q')).toHaveLength(1);
  view.rerender(<OffPageHistory key="q" projectId="q" current={null} saved />);
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.getByText('TBVA: 0.8 · Scored/requested: 1/1')).toBeTruthy();
});

it('retains visible records when deletion or clearing fails', () => {
  saveOffPageHistory('p', current);
  render(<OffPageHistory projectId="p" current={null} saved />);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('locked'); });
  fireEvent.click(screen.getByRole('button', { name: 'Delete record' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Delete record' })).toBeTruthy();
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('locked'); });
  fireEvent.click(screen.getByRole('button', { name: 'Clear project history' }));
  expect(screen.getByRole('button', { name: 'Delete record' })).toBeTruthy();
});

it('renders unknown evidence, topic/model fallbacks, limitations and unavailable TBVA without fabricated zeros', () => {
  const record = historyRecord({ topicLabel: '', embeddingModelId: null, coCitations: [],
    tbva: { value: null, status: 'unavailable', limitations: ['no-topic-vector'] },
    sources: [{ ...current.sources[0], availability: null, fetchedAt: null, authority: null, similarity: null, contribution: null }] });
  render(<OffPageHistoryDetails record={record} />);
  expect(screen.getByText('Topic: Unavailable')).toBeTruthy();
  expect(screen.getByText('Embedding: local-hash / Unavailable')).toBeTruthy();
  expect(screen.getByText(/No usable Core Topic vector/u)).toBeTruthy();
  const table = within(screen.getByRole('table'));
  expect(table.getByText('Not fetched')).toBeTruthy(); expect(table.getByText('Pending')).toBeTruthy();
  expect(table.getAllByText('Unavailable')).toHaveLength(3);
  expect(screen.queryByLabelText('Co-citation excerpts')).toBeNull();
});
