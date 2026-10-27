import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { CrawlImageAltQuality } from '@/components/Domain/crawlResults/mediaTab/CrawlImageAltQuality';
import { CrawlMediaImagesSection } from '@/components/Domain/crawlResults/mediaTab/CrawlMediaImagesSection';
import { CrawlModelAnalysisNotice } from '@/components/Domain/crawlResults/mediaTab/CrawlModelAnalysisNotice';
import { auditImagesCsv, crawlImagesCsv } from '@/services/export';
import { checkAlt } from '@/services/multimodal';
import { audit, crawlRun } from './fixtures/export';

const t = ((key: string, options?: object) => i18n.t(key, options as never)) as never;
const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'];
const ISSUES = ['missing', 'empty', 'filename', 'generic', 'too-long', 'repeats-caption', 'unrelated-to-context'];

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

const image = (src: string, alt?: string) => ({ src, ...(alt === undefined ? {} : { alt }), lazy_loaded: false });
const pageWith = (images: unknown[]) => [{ url: 'https://a.test/', images }] as never;

describe('ALT quality in the media tab', () => {
  it('labels issues, decorative images and clean ALT text', () => {
    const { rerender } = render(<CrawlImageAltQuality verdict={checkAlt({ src: '/a.jpg' })} t={t} />);
    expect(screen.getByText('Missing ALT')).toBeTruthy();
    rerender(<CrawlImageAltQuality verdict={checkAlt({ src: '/a.jpg', alt: 'IMG_1234.jpg' })} t={t} />);
    expect(screen.getByText('Looks like a file name')).toBeTruthy();
    rerender(<CrawlImageAltQuality verdict={checkAlt({ src: '/a.jpg', alt: '' })} t={t} />);
    expect(screen.getByText('Decorative (empty ALT)')).toBeTruthy();
    rerender(<CrawlImageAltQuality verdict={checkAlt({ src: '/a.jpg', alt: 'Red bicycle leaning on a brick wall' })} t={t} />);
    expect(screen.getByText('No ALT issues')).toBeTruthy();
  });

  it('states that visual analyses are unavailable and never lower a score', () => {
    render(<CrawlModelAnalysisNotice t={t} />);
    expect(screen.getByRole('note').textContent).toContain('Visual analysis needs a local model');
    expect(screen.getAllByText(/: Unavailable$/)).toHaveLength(3);
    for (const name of ['OCR', 'CLIP alignment', 'Transcripts']) expect(screen.getByText(`${name}: Unavailable`)).toBeTruthy();
    expect(screen.getByText('This does not lower any score.')).toBeTruthy();
  });

  it('summarizes checked images and shows the ALT column last', () => {
    render(<CrawlMediaImagesSection pages={pageWith([image('/a.jpg'), image('/b.jpg', 'Red bicycle leaning on a brick wall'), image('/c.jpg', 'photo')])} t={t} />);
    expect(screen.getByText('3 images checked, 2 with ALT issues.')).toBeTruthy();
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers.at(-1)).toBe('ALT quality');
    expect(screen.getByText('Generic wording')).toBeTruthy();
  });

  it('reports zero issues when every image is fine', () => {
    render(<CrawlMediaImagesSection pages={pageWith([image('/b.jpg', 'Red bicycle leaning on a brick wall')])} t={t} />);
    expect(screen.getByText('1 images checked, 0 with ALT issues.')).toBeTruthy();
  });
});

describe('ALT issues in CSV exports', () => {
  it('appends alt_issues as the last crawl-image column without moving existing columns', () => {
    const run = { ...crawlRun, result: { ...crawlRun.result, pages: [{ ...crawlRun.result.pages[0], images: [image('/a.jpg'), image('/b.jpg', 'Red bicycle leaning on a brick wall'), image('/c.jpg', 'DSC_0042.jpg')] }] } } as never;
    const rows = crawlImagesCsv(run).split('\r\n').filter((line) => line.includes('/a.jpg') || line.includes('/b.jpg') || line.includes('/c.jpg') || line.includes('alt_issues'));
    expect(rows[0].endsWith('"alt_issues"')).toBe(true);
    expect(rows[1].endsWith('"missing"')).toBe(true);
    expect(rows[2].endsWith('""')).toBe(true);
    expect(rows[3].endsWith('"filename"')).toBe(true);
  });

  it('adds the same column to the single-page audit images CSV', () => {
    const csv = auditImagesCsv({ ...audit, images: [{ src: '/a.jpg', alt: '', has_alt: false }, { src: '/b.jpg', alt: 'photo', has_alt: true }] } as never);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0].endsWith('"alt_issues"')).toBe(true);
    expect(lines[1].endsWith('"missing"')).toBe(true);
    expect(lines[2].endsWith('"generic"')).toBe(true);
  });
});

describe('ALT check translations', () => {
  it('has the full altCheckUi block in every locale', async () => {
    const english = (await import('@/i18n/locales/en.json')).default.altCheckUi;
    for (const locale of LOCALES) {
      const block = (await import(`@/i18n/locales/${locale}.json`)).default.altCheckUi;
      expect(Object.keys(block.issues).sort(), locale).toEqual([...ISSUES].sort());
      expect(Object.keys(block.analyses).sort(), locale).toEqual(['clip-alignment', 'ocr', 'transcript']);
      expect(block.summary, locale).toContain('{{checked}}');
      expect(block.summary, locale).toContain('{{issues}}');
      expect(block.csvColumn, locale).toBe('alt_issues');
      if (locale !== 'en') expect(block.column, locale).not.toBe(english.column);
    }
  });
});
