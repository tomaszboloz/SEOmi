import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlImageOcr } from '@/components/Domain/crawlResults/mediaTab/CrawlImageOcr';
import { createLexicalAlignmentProvider, MAX_OCR_IMAGES, ocrMediaFacts, pageHtmlText, runImageOcr, type ImageByteSource } from '@/services/multimodal';
import { createCrawlPageFixture } from './fixtures/crawl';

const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
const source: ImageByteSource = { id: 't', fetch: async (url) => (url.includes('blocked') ? { ok: false, failure: 'blocked' } : { ok: true, bytes: png, contentType: 'image/png' }) };
const reply = (text: string) => vi.fn().mockImplementation(async () => new Response(JSON.stringify({ response: text }), { status: 200 }));
const page = createCrawlPageFixture({ title: 'Acme red shoes', meta_description: 'Buy running footwear online',
  heading_texts: { h1: ['Acme red shoes'], h2: ['Delivery info'], h3: [] },
  images: [{ src: '/red-shoes.png', alt: 'red shoes' }, { src: '/blocked.png', alt: '' }, { src: '/x.png' }, { src: 'data:x', alt: 'd' }] as never });
const signal = () => new AbortController().signal;
beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

it('lexical alignment scores token overlap, labels its text source and never reports confidence', async () => {
  const provider = createLexicalAlignmentProvider(() => 'T');
  const base = { bytes: png, contentHash: 'h' };
  const withAlt = await provider.analyze({ ...base, url: 'https://a.test/red-shoes.png', context: { alt: 'red shoes', paragraph: 'Red shoes for runners' } }, signal());
  expect(withAlt).toMatchObject({ similarity: 1, dimension: 2, textSource: 'alt', provenance: { confidence: null, analyzedAt: 'T', provider: 'lexical-heuristic' } });
  const fileOnly = await provider.analyze({ ...base, url: 'https://a.test/blue_hat.jpg', context: { paragraph: 'a blue sky' } }, signal());
  expect(fileOnly).toMatchObject({ similarity: 0.5, textSource: 'paragraph' });
  await expect(provider.analyze({ ...base, url: 'not a url', context: { paragraph: 'x' } }, signal())).rejects.toThrow('No text');
  await expect(provider.analyze({ ...base, url: 'https://a.test/a.png', context: { alt: 'photo', paragraph: '' } }, signal())).rejects.toThrow('No text');
  await expect(createLexicalAlignmentProvider().analyze({ ...base, url: 'https://a.test/p.png', context: { alt: 'x', paragraph: 'p' } }, signal())).rejects.toThrow();
  expect((await createLexicalAlignmentProvider().analyze({ ...base, url: 'https://a.test/p.png', context: { alt: 'photo shoes', paragraph: 'shoes' } }, signal())).provenance.analyzedAt).toMatch(/^\d{4}-/);
});

it('lexical alignment handles missing context parts', async () => {
  const provider = createLexicalAlignmentProvider(() => 'T');
  const base = { bytes: png, contentHash: 'h', url: 'https://a.test/red.png' };
  await expect(provider.analyze(base, signal())).rejects.toThrow('No text');
  await expect(provider.analyze({ ...base, context: { alt: 'red' } }, signal())).rejects.toThrow('No text');
});

it('runs OCR sequentially with typed failures, model errors and bounded count', async () => {
  const fetchImpl = reply('Free delivery over 100\nAcme red shoes');
  const rows: unknown[] = [];
  const done = await runImageOcr([{ url: 'https://a.test/red-shoes.png', alt: 'red shoes' }, { url: 'https://a.test/blocked.png' }], [page], { model: 'llava', signal: signal(), source, fetchImpl, onRow: (row) => rows.push(row) });
  expect(done).toMatchObject([{ status: 'ok', alignment: { similarity: 1 } }, { status: 'failed', failure: 'blocked' }]);
  expect(rows).toHaveLength(2);
  const facts = ocrMediaFacts(done, [page]);
  expect(facts.map((fact) => [fact.text, fact.origin, fact.quality])).toEqual([['Free delivery over 100', 'media-only', 'partial'], ['Acme red shoes', 'duplicate-of-html', 'partial']]);
  const failing = await runImageOcr([{ url: 'https://a.test/a.png' }], [], { model: 'llava', signal: signal(), source, fetchImpl: vi.fn().mockRejectedValue(new Error('down')) });
  expect(failing).toEqual([{ url: 'https://a.test/a.png', status: 'failed', failure: 'model-error' }]);
  const many = Array.from({ length: MAX_OCR_IMAGES + 3 }, (_, i) => ({ url: `https://a.test/${i}.png` }));
  expect(await runImageOcr(many, [], { model: 'llava', signal: signal(), source, fetchImpl: reply('NONE') })).toHaveLength(MAX_OCR_IMAGES);
  const noAlt = await runImageOcr([{ url: 'https://a.test/x.png' }], [], { model: 'llava', signal: signal(), source, fetchImpl: reply('NONE') });
  expect(noAlt[0]).toMatchObject({ status: 'ok', alignment: null });
  expect(pageHtmlText([createCrawlPageFixture()])).toBe('');
  await expect(runImageOcr([], [], { model: ' ', signal: signal() })).rejects.toThrow('model name');
  const aborted = new AbortController();
  const abortingFetch = vi.fn().mockImplementation(async () => { aborted.abort(); throw new Error('x'); });
  await expect(runImageOcr([{ url: 'https://a.test/a.png' }], [], { model: 'llava', signal: aborted.signal, source, fetchImpl: abortingFetch })).rejects.toThrow();
  const viaDefault = vi.fn().mockRejectedValue(new Error('offline'));
  vi.stubGlobal('fetch', viaDefault);
  expect(await runImageOcr([{ url: 'https://a.test/a.png' }], [], { model: 'llava', signal: signal() })).toEqual([{ url: 'https://a.test/a.png', status: 'failed', failure: 'blocked' }]);
  vi.unstubAllGlobals();
  const pre = new AbortController(); pre.abort();
  await expect(runImageOcr([{ url: 'https://a.test/a.png' }], [], { model: 'llava', signal: pre.signal, source })).rejects.toThrow();
});

it('panel stays disabled without a model, runs, persists the model and shows partial facts', async () => {
  const fetchImpl = reply('Free delivery over 100');
  render(<CrawlImageOcr pages={[page]} t={i18n.t} source={source} fetchImpl={fetchImpl} />);
  const run = screen.getByRole('button', { name: 'Run OCR' }) as HTMLButtonElement;
  expect(run.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Ollama vision model'), { target: { value: ' llava ' } });
  expect(localStorage.getItem('seomi.multimodal.ocrModel')).toBe('llava');
  fireEvent.click(screen.getByRole('button', { name: 'Run OCR' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('OCR finished: 2 done, 1 failed.'));
  expect(screen.getAllByText(/Free delivery over 100/u)[0].textContent).toContain('only in the image, partial');
  expect(screen.getByText(/red-shoes.png: text overlap 100% \(heuristic\)/u)).toBeTruthy();
});

it('panel restores the saved model, cancels, and reports an unexpected stop', async () => {
  localStorage.setItem('seomi.multimodal.ocrModel', 'saved');
  const slow: ImageByteSource = { id: 's', fetch: (_url, abort) => new Promise((_, reject) => abort.addEventListener('abort', () => reject(new Error('stop')))) };
  const { rerender } = render(<CrawlImageOcr pages={[page]} t={i18n.t} source={slow} />);
  expect((screen.getByLabelText('Ollama vision model') as HTMLInputElement).value).toBe('saved');
  fireEvent.click(screen.getByRole('button', { name: 'Run OCR' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel OCR' }));
  expect(screen.getByRole('status').textContent).toBe('OCR cancelled: 0 done, 0 failed.');
  const broken: ImageByteSource = { id: 'b', fetch: async () => { throw new Error('boom'); } };
  rerender(<CrawlImageOcr pages={[page]} t={i18n.t} source={broken} />);
  fireEvent.click(screen.getByRole('button', { name: 'Run OCR' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('OCR stopped on an error: 0 done, 0 failed.'));
  rerender(<CrawlImageOcr pages={[]} t={i18n.t} source={broken} />);
  expect((screen.getByRole('button', { name: 'Run OCR' }) as HTMLButtonElement).disabled).toBe(true);
});

it('panel does not report done when cancelled during the last image', async () => {
  let release!: () => void;
  const late: ImageByteSource = { id: 'l', fetch: () => new Promise((resolve) => { release = () => resolve({ ok: false, failure: 'blocked' }); }) };
  localStorage.setItem('seomi.multimodal.ocrModel', 'saved');
  const single = createCrawlPageFixture({ images: [{ src: '/a.png' }] as never });
  render(<CrawlImageOcr pages={[single]} t={i18n.t} source={late} />);
  fireEvent.click(screen.getByRole('button', { name: 'Run OCR' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel OCR' }));
  release();
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('OCR cancelled: 0 done, 1 failed.'));
});
