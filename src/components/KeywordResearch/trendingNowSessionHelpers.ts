export type TrendingImportFormat = 'csv' | 'json';

export const fileFormat = (file: File): TrendingImportFormat | null => {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'csv' || file.type === 'text/csv') return 'csv';
  if (extension === 'json' || file.type === 'application/json') return 'json';
  return null;
};

export const messageFor = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const readFile = (file: File): Promise<string> => {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
    reader.readAsText(file);
  });
};
