import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import {
  browserImageSource, canvasDecoder, externalImageSearchState, hashImages, MAX_HASHED_IMAGES, MAX_IMAGE_BYTES, MODEL_PROVIDERS,
  nearDuplicatePairs, resolveModelProvider, sha256Hex, type GrayImage, type ImageByteSource, type ImageHashRow,
} from '@/services/multimodal';
import { CrawlImageNearDuplicates, crawlImageUrls } from '@/components/Domain/crawlResults/mediaTab/CrawlImageNearDuplicates';
import { createCrawlPageFixture } from './fixtures/crawl';

/** Gradient image; `shift` adds a uniform brightness change, `flip` mirrors it (a different picture). */
const gradient = (size: number, shift = 0, flip = false): GrayImage => ({
  width: size, height: size,
  gray: Array.from({ length: size * size }, (_, i) => {
    const x = (flip ? size - 1 - (i % size) : i % size) / size;
    const y = Math.floor(i / size) / size;
    return ((Math.floor(x * 8) * 37 + Math.floor(y * 8) * 91) % 200) + shift;
  }),
});
const images: Record<string, GrayImage | null> = {
  'https://s.test/a.jpg': gradient(64), 'https://s.test/a-small.jpg': gradient(32, 3), 'https://s.test/b.jpg': gradient(64, 0, true), 'https://s.test/broken.jpg': null,
};
const source: ImageByteSource = {
  id: 'test',
  fetch: async (url) => (url.includes('blocked') ? { ok: false, failure: 'blocked' } : { ok: true, bytes: new Blob([url]), contentType: 'image/jpeg' }),
};
const decode = async (bytes: Blob) => images[await bytes.text()] ?? null;
const signal = () => new AbortController().signal;
const response = (body: string, type = 'image/png', status = 200, length?: string) =>
  new Response(body, { status, headers: { 'content-type': type, ...(length ? { 'content-length': length } : {}) } });

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('image byte source (#96)', () => {
  it('reads CORS-allowed images and reports typed failures without guessing', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('throw')) throw new TypeError('CORS');
      if (href.includes('404')) return response('', 'image/png', 404);
      if (href.includes('svg')) return response('<svg/>', 'image/svg+xml');
      if (href.includes('huge')) return response('x', 'image/png', 200, String(MAX_IMAGE_BYTES + 1));
      if (href.includes('big')) return response('x'.repeat(MAX_IMAGE_BYTES + 1));
      return response('png-bytes', 'image/png; charset=binary');
    });
    const reader = browserImageSource(fetchImpl as typeof fetch);
    expect(await reader.fetch('https://s.test/a.png', signal())).toMatchObject({ ok: true, contentType: 'image/png' });
    expect(fetchImpl).toHaveBeenCalledWith('https://s.test/a.png', expect.objectContaining({ mode: 'cors', credentials: 'omit' }));
    for (const [url, failure] of [['https://s.test/throw', 'blocked'], ['https://s.test/404', 'http-error'], ['https://s.test/svg', 'not-image'],
      ['https://s.test/huge', 'too-large'], ['https://s.test/big', 'too-large'], ['data:image/png;base64,AA', 'unsupported-url'], ['::', 'unsupported-url']]) {
      expect(await reader.fetch(url, signal())).toEqual({ ok: false, failure });
    }
    const abort = new AbortController();
    abort.abort();
    await expect(reader.fetch('https://s.test/throw', abort.signal)).rejects.toThrow();
    expect(await canvasDecoder(new Blob(['x']))).toBeNull();
    expect(await sha256Hex(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('near-duplicate detection (#96 GEM-96-03)', () => {
  it('hashes each URL once and pairs resized copies but not a mirrored picture', async () => {
    const rows = await hashImages([...Object.keys(images), 'https://s.test/a.jpg', 'https://s.test/blocked.jpg'], { source, decode, signal: signal(), now: () => new Date(0) });
    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.status === 'failed').map((row) => row.status === 'failed' && row.failure)).toEqual(['decode-failed', 'blocked']);
    expect(rows[0]).toMatchObject({ status: 'hashed', source: 'test', hashedAt: '1970-01-01T00:00:00.000Z' });
    const pairs = nearDuplicatePairs(rows);
    expect(pairs.map((pair) => [pair.left, pair.right])).toEqual([['https://s.test/a.jpg', 'https://s.test/a-small.jpg']]);
    expect(pairs[0].identicalBytes).toBe(false);
    const same: ImageHashRow[] = [{ url: 'x', status: 'hashed', phash: '0'.repeat(16), sha256: 'h', source: 's', hashedAt: '' }, { url: 'y', status: 'hashed', phash: '0'.repeat(16), sha256: 'h', source: 's', hashedAt: '' }];
    expect(nearDuplicatePairs(same, 0)).toEqual([{ left: 'x', right: 'y', distance: 0, identicalBytes: true }]);
    const many = Array.from({ length: MAX_HASHED_IMAGES + 4 }, (_, i) => `https://s.test/blocked-${i}`);
    expect(await hashImages(many, { source, decode, signal: signal() })).toHaveLength(MAX_HASHED_IMAGES);
    const abort = new AbortController();
    abort.abort();
    await expect(hashImages(['https://s.test/a.jpg'], { source, decode, signal: abort.signal })).rejects.toThrow();
  });

  it('keeps model analyses and external image search unavailable', () => {
    expect(resolveModelProvider('ocr')).toBeNull();
    expect(Object.keys(MODEL_PROVIDERS)).toEqual([]);
    const provider = { analysis: 'transcript' as const, id: 'local', analyze: vi.fn() };
    expect(resolveModelProvider('transcript', { transcript: provider })).toBe(provider);
    expect(externalImageSearchState()).toEqual({ status: 'unavailable', reason: 'no-images-provider' });
  });
});

describe('CrawlImageNearDuplicates', () => {
  const pages = [createCrawlPageFixture({ url: 'https://s.test/page', images: [
    { src: '/a.jpg' }, { src: 'https://s.test/a-small.jpg' }, { src: 'b.jpg' }, { src: 'https://s.test/blocked.jpg' }, { src: 'data:x' }, { src: 'http://[' },
  ] as never })];
  it('resolves image URLs and shows pairs, failures and limits', async () => {
    expect(crawlImageUrls(pages)).toEqual(['https://s.test/a.jpg', 'https://s.test/a-small.jpg', 'https://s.test/b.jpg', 'https://s.test/blocked.jpg']);
    render(<CrawlImageNearDuplicates pages={pages} t={i18n.t} source={source} decode={decode} />);
    expect(screen.getByText(/no images provider configured/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Maximum differing bits (0–16)'), { target: { value: '99' } });
    expect((screen.getByLabelText('Maximum differing bits (0–16)') as HTMLInputElement).value).toBe('16');
    fireEvent.change(screen.getByLabelText('Maximum differing bits (0–16)'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hash 4 images' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Done: 3 hashed, 1 unavailable'));
    expect(screen.getByText('1 blocked or unreachable')).toBeTruthy();
    expect(screen.getByText(/s\.test\/a(-small)?\.jpg ≈ https:\/\/s\.test\/a(-small)?\.jpg \(0 bits differ\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Maximum differing bits (0–16)'), { target: { value: '' } });
    expect((screen.getByLabelText('Maximum differing bits (0–16)') as HTMLInputElement).value).toBe('0');
    cleanup();
    const blocked: ImageByteSource = { id: 'b', fetch: async () => ({ ok: false, failure: 'http-error' }) };
    render(<CrawlImageNearDuplicates pages={pages} t={i18n.t} source={blocked} decode={decode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hash 4 images' }));
    await waitFor(() => expect(screen.getByText('No near-duplicate pair at this threshold.')).toBeTruthy());
    expect(screen.getByText('4 HTTP error')).toBeTruthy();
  });

  it('cancels a running batch', async () => {
    const slow: ImageByteSource = { id: 'slow', fetch: () => new Promise(() => undefined) };
    render(<CrawlImageNearDuplicates pages={pages} t={i18n.t} source={slow} decode={decode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hash 4 images' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('status').textContent).toBe('Cancelled: 0 hashed, 0 unavailable');
  });
});
