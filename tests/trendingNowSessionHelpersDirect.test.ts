import { describe, expect, it } from 'vitest';
import {
  fileFormat,
  messageFor,
  readFile,
} from '@/components/KeywordResearch/trendingNowSessionHelpers';

describe('trendingNowSessionHelpers direct assertions', () => {
  it('fileFormat detects csv and json formats from extension and mime-type', () => {
    const csvFile = new File(['a,b'], 'data.csv', { type: 'text/csv' });
    expect(fileFormat(csvFile)).toBe('csv');

    const jsonFile = new File(['{}'], 'data.json', { type: 'application/json' });
    expect(fileFormat(jsonFile)).toBe('json');

    const txtFile = new File(['text'], 'data.txt', { type: 'text/plain' });
    expect(fileFormat(txtFile)).toBeNull();
  });

  it('messageFor extracts error message or returns fallback', () => {
    expect(messageFor(new Error('custom error'), 'fallback')).toBe('custom error');
    expect(messageFor('not-an-error-object', 'fallback')).toBe('fallback');
    expect(messageFor(null, 'fallback')).toBe('fallback');
    expect(messageFor(new Error(''), 'fallback')).toBe('fallback');
  });

  it('readFile reads file text using File.text() or FileReader fallback', async () => {
    const file = new File(['test content'], 'sample.txt', { type: 'text/plain' });
    const content = await readFile(file);
    expect(content).toBe('test content');
  });
});
