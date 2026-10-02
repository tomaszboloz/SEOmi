import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { BatchAuditQueue } from '@/components/URLBar/BatchAuditQueue';
import { UrlField } from '@/components/URLBar/UrlField';
import { useAuditStore, type BatchAuditItem } from '@/stores/auditStore';

const initial = useAuditStore.getState();
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { useAuditStore.setState(initial, true); vi.unstubAllGlobals(); });

const item = (id: string, status: BatchAuditItem['status']) => ({ id, url: `https://a.test/${id}`, status }) as BatchAuditItem;

describe('URL field', () => {
  it('reports typing and trims a pasted clipboard URL', async () => {
    const updateUrl = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { readText: vi.fn().mockResolvedValue('  https://pasted.test/  ') } });
    render(<UrlField url="https://a.test/" isLoading={false} updateUrl={updateUrl} />);
    fireEvent.change(screen.getByRole('textbox', { name: i18n.t('legacyUi.url.urlAria') }), { target: { value: 'https://typed.test/' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('urlBar.quickPaste')) }));
    await waitFor(() => expect(updateUrl).toHaveBeenLastCalledWith('https://pasted.test/'));
    expect(updateUrl).toHaveBeenNthCalledWith(1, 'https://typed.test/');
  });

  it('locks the field while loading and ignores denied clipboard access', async () => {
    const updateUrl = vi.fn();
    const readText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { readText } });
    render(<UrlField url="" isLoading updateUrl={updateUrl} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(readText).toHaveBeenCalledOnce());
    expect(updateUrl).not.toHaveBeenCalled();
  });
});

describe('batch audit queue', () => {
  it('renders nothing for an empty queue', () => {
    useAuditStore.setState({ batchItems: [] });
    expect(render(<BatchAuditQueue />).container.textContent).toBe('');
  });

  it('resumes a partially processed queue and clears it', () => {
    const startBatchAudits = vi.fn().mockResolvedValue(undefined); const clearBatchAudits = vi.fn();
    useAuditStore.setState({ batchItems: [item('a', 'completed'), item('b', 'queued'), item('c', 'failed')], batchRejectedRows: [],
      batchRun: null, isBatchRunning: false, isBatchStopping: false, batchWakeupError: 'wakeup failed', startBatchAudits, clearBatchAudits });
    render(<BatchAuditQueue />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('legacyUi.url.resume')) }));
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.url.clearQueue')));
    expect(startBatchAudits).toHaveBeenCalledOnce();
    expect(clearBatchAudits).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert').textContent).toBe('wakeup failed');
  });

  it('offers stop while running and disables clearing', () => {
    const stopBatchAudits = vi.fn();
    useAuditStore.setState({ batchItems: [item('a', 'running')], batchRejectedRows: [], isBatchRunning: true, isBatchStopping: false,
      batchRun: { id: 'r', status: 'running', startedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }, batchWakeupError: null, stopBatchAudits });
    render(<BatchAuditQueue />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('legacyUi.url.stop')) }));
    expect(stopBatchAudits).toHaveBeenCalledOnce();
    expect((screen.getByTitle(i18n.t('legacyUi.url.clearQueue')) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('region').textContent).toContain(i18n.t('legacyUi.url.runRunning'));
  });
});
