import i18n from '@/i18n';

export const spreadsheetSafe = (value: unknown): string => {
  const text = String(value ?? '');
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
};

export const escapeCsv = (value: unknown): string => `"${spreadsheetSafe(value).replaceAll('"', '""')}"`;

export const csv = (rows: unknown[][]): string => rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
export const exportText = (key: string, variables?: Record<string, unknown>): string => i18n.t(`exportUi.${key}`, variables);
export const exportHeaders = (key: string): string[] => {
  const value = i18n.t(`exportUi.headers.${key}`, { returnObjects: true });
  return Array.isArray(value) ? value.map(String) : [];
};

