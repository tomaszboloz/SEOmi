import { afterEach, expect, it, vi } from 'vitest';
import { downloadAuditPdf, downloadText } from '@/services/export';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn().mockResolvedValue('JVBERiBmaXh0dXJl') }));

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('removes the anchor and releases the Blob URL even when clicking fails', () => {
  vi.useFakeTimers();
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('download blocked'); });
  expect(() => downloadText('report.txt', 'report', 'text/plain')).toThrow('download blocked');
  vi.runAllTimers();
  expect(create).toHaveBeenCalledTimes(1);
  expect(document.querySelector('a[download="report.txt"]')).toBeNull();
  expect(revoke).toHaveBeenCalledWith('blob:fixture');
});

it('uses the same cleanup lifecycle for a successful PDF download', async () => {
  vi.useFakeTimers();
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-fixture');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  await downloadAuditPdf({ final_url: 'https://example.com', timestamp: '2026-10-01' } as never);
  expect(click).toHaveBeenCalledTimes(1);
  const blob = create.mock.calls[0][0];
  expect(blob instanceof Blob ? blob.type : null).toBe('application/pdf');
  expect(document.querySelector('a[download]')).toBeNull();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:pdf-fixture');
});

it('releases a created URL when anchor creation fails', () => {
  vi.useFakeTimers();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(document, 'createElement').mockImplementationOnce(() => { throw new Error('DOM blocked'); });
  expect(() => downloadText('report.txt', 'report', 'text/plain')).toThrow('DOM blocked');
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:fixture');
});
