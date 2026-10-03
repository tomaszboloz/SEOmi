import { afterEach, expect, it, vi } from 'vitest';
import { downloadText, downloadPdf } from '@/services/export/download';
import { downloadAuditPdf } from '@/services/export';
import { invokeTauriCommand } from '@/services/tauri';
import { downloadBlob } from '@/services/download';
import { audit } from './fixtures/export';
import i18n from '@/i18n';
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
vi.mock('@/services/download', () => ({ downloadBlob: vi.fn() }));
afterEach(() => vi.resetAllMocks());
it('downloads exactly the supplied UTF-8 text with the requested MIME type', async () => {
  const text = 'Zażółć'; downloadText('observed.txt', text, 'text/plain');
  const [name, blob] = vi.mocked(downloadBlob).mock.calls[0];
  expect(name).toBe('observed.txt'); expect(blob.type).toBe('text/plain;charset=utf-8');
  expect(blob.size).toBe(new TextEncoder().encode(text).length);
  const value = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
  expect(value).toBe(text);
});
it('passes exact native arguments and downloads the decoded PDF bytes', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(btoa('%PDF-1.7\n'));
  await downloadPdf('generate_crawl_pdf', { run: { id: 'observed' } }, 'observed.pdf');
  expect(invokeTauriCommand).toHaveBeenCalledWith('generate_crawl_pdf', { run: { id: 'observed' } });
  expect(vi.mocked(downloadBlob).mock.calls[0]).toEqual(['observed.pdf', expect.objectContaining({ type: 'application/pdf', size: 9 })]);
});
it('calls the public audit PDF action with its immutable audit and meaningful filename', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(btoa('%PDF-fixture'));
  await downloadAuditPdf(audit);
  expect(invokeTauriCommand).toHaveBeenCalledWith('generate_audit_pdf', { audit });
  expect(vi.mocked(downloadBlob).mock.calls[0][0]).toBe('seomi-audit-example.com-2026-09-20.pdf');
});
it.each([null, 42, '', 'bad base64!', btoa('wrong header')])('rejects malformed native wire data %j with a localized error', async encoded => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(encoded);
  await expect(downloadPdf('generate_audit_pdf', { audit }, 'observed.pdf')).rejects.toThrow(i18n.t('exportUi.invalidPdf'));
  expect(downloadBlob).not.toHaveBeenCalled();
});
it('preserves a native failure without attempting to download a file', async () => {
  vi.mocked(invokeTauriCommand).mockRejectedValue(new Error('native renderer unavailable'));
  await expect(downloadPdf('generate_audit_pdf', { audit }, 'observed.pdf')).rejects.toThrow('native renderer unavailable');
  expect(downloadBlob).not.toHaveBeenCalled();
});
