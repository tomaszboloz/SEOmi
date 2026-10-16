import i18n from '@/i18n';
import { downloadBlob } from '@/services/download';
import { invokeTauriCommand } from '@/services/tauri';
import { exportText } from './csv';

export const downloadText = (filename: string, text: string, mimeType: string): void =>
  downloadBlob(filename, new Blob([text], { type: `${mimeType};charset=utf-8` }));

/** Active UI language's `pdfReport` bundle; the renderer falls back to English per missing key. */
const pdfLanguageFields = (): { pdf_locale: string; pdf_labels: unknown } => ({
  pdf_locale: i18n.language,
  pdf_labels: i18n.getResource(i18n.language, 'translation', 'pdfReport') ?? {},
});

export const downloadPdf = async (command: 'generate_audit_pdf' | 'generate_crawl_pdf', args: Record<string, unknown>, filename: string): Promise<void> => {
  const key = command === 'generate_audit_pdf' ? 'audit' : 'run';
  const encoded = await invokeTauriCommand<string>(command, { ...args, [key]: { ...(args[key] as object), ...pdfLanguageFields() } });
  let binary: string;
  try {
    if (typeof encoded !== 'string') throw new Error('Invalid encoded data');
    binary = atob(encoded);
  } catch {
    throw new Error(exportText('invalidPdf'));
  }
  if (!binary.startsWith('%PDF-')) throw new Error(exportText('invalidPdf'));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  downloadBlob(filename, new Blob([bytes], { type: 'application/pdf' }));
};
