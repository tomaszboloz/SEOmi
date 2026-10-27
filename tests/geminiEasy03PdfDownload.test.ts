import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadPdf } from '@/services/export/download';
import { exportText } from '@/services/export/csv';
import { invokeTauriCommand } from '@/services/tauri';
import { downloadBlob } from '@/services/download';

vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(),
  isTauriEnvironment: vi.fn(),
}));

vi.mock('@/services/download', () => ({
  downloadBlob: vi.fn(),
}));

describe('PDF export safety: genuine header validation and transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts base64 data starting with genuine %PDF- (0x25 0x50 0x44 0x46 0x2d) header for audit report', async () => {
    const validPdfBinary = '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Audit) >>\nendobj';
    const base64Pdf = btoa(validPdfBinary);
    vi.mocked(invokeTauriCommand).mockResolvedValue(base64Pdf);

    const auditData = { id: 'audit-001', final_url: 'https://example.com' };
    await downloadPdf('generate_audit_pdf', { audit: auditData }, 'seomi-audit.pdf');

    expect(invokeTauriCommand).toHaveBeenCalledWith(
      'generate_audit_pdf',
      expect.objectContaining({
        audit: expect.objectContaining({
          id: 'audit-001',
          final_url: 'https://example.com',
          pdf_locale: expect.any(String),
          pdf_labels: expect.any(Object),
        }),
      })
    );

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [filename, blob] = vi.mocked(downloadBlob).mock.calls[0];
    expect(filename).toBe('seomi-audit.pdf');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');

    const buffer = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(buffer.slice(0, 5))).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  it('accepts genuine %PDF- header for crawl report and decorates run key with language fields', async () => {
    const validPdfBinary = '%PDF-2.0\nCrawl Snapshot Content';
    vi.mocked(invokeTauriCommand).mockResolvedValue(btoa(validPdfBinary));

    const runData = { id: 'run-777', startUrl: 'https://example.com' };
    await downloadPdf('generate_crawl_pdf', { run: runData }, 'seomi-crawl.pdf');

    expect(invokeTauriCommand).toHaveBeenCalledWith(
      'generate_crawl_pdf',
      expect.objectContaining({
        run: expect.objectContaining({
          id: 'run-777',
          startUrl: 'https://example.com',
          pdf_locale: expect.any(String),
          pdf_labels: expect.any(Object),
        }),
      })
    );
    expect(downloadBlob).toHaveBeenCalledWith('seomi-crawl.pdf', expect.any(Blob));
  });

  it('rejects data with mutated or non-matching magic signature bytes and avoids downloadBlob', async () => {
    const invalidHeaders = [
      btoa('%PDG-1.4 mismatched fourth byte'),
      btoa('%pdf-1.4 lowercase magic mismatch'),
      btoa('<!DOCTYPE html><html><body>Error</body></html>'),
      btoa('{"error":"Render failed"}'),
      btoa('PK\x03\x04ziparchive'),
      btoa('\x89PNG\r\n\x1a\n'),
      btoa('%PD'),
      btoa('%'),
      btoa(''),
    ];

    for (const invalidData of invalidHeaders) {
      vi.mocked(invokeTauriCommand).mockResolvedValueOnce(invalidData);
      await expect(
        downloadPdf('generate_audit_pdf', { audit: {} }, 'audit.pdf')
      ).rejects.toThrow(exportText('invalidPdf'));
    }

    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('rejects malformed non-base64 strings where atob decoding fails', async () => {
    vi.mocked(invokeTauriCommand).mockResolvedValue('***malformed-base64-payload***@@@');

    await expect(
      downloadPdf('generate_audit_pdf', { audit: {} }, 'audit.pdf')
    ).rejects.toThrow(exportText('invalidPdf'));

    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('rejects non-string response payloads from Tauri transport', async () => {
    const nonStringResponses = [null, undefined, 12345, { binary: '%PDF-1.4' }];

    for (const payload of nonStringResponses) {
      vi.mocked(invokeTauriCommand).mockResolvedValueOnce(payload as unknown as string);
      await expect(
        downloadPdf('generate_audit_pdf', { audit: {} }, 'audit.pdf')
      ).rejects.toThrow(exportText('invalidPdf'));
    }

    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('propagates transport failures when invokeTauriCommand rejects', async () => {
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('Tauri backend IPC error'));

    await expect(
      downloadPdf('generate_audit_pdf', { audit: {} }, 'audit.pdf')
    ).rejects.toThrow('Tauri backend IPC error');

    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
