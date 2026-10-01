import { afterEach, expect, it, vi } from 'vitest';
import { downloadAuditPdf } from '@/services/export';
import { invokeTauriCommand } from '@/services/tauri';
import { downloadBlob } from '@/services/download';
import { audit } from './fixtures/export';
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
vi.mock('@/services/download', () => ({ downloadBlob: vi.fn() }));
afterEach(() => vi.resetAllMocks());
it.each(['', 'not base64', btoa('not a PDF')])('rejects invalid native PDF payload %j before publishing a file', async encoded => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(encoded);
  await expect(downloadAuditPdf(audit)).rejects.toThrow();
  expect(downloadBlob).not.toHaveBeenCalled();
});
