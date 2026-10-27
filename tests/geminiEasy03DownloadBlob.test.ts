import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '@/services/download';
import { downloadText } from '@/services/export/download';

describe('download export safety: downloadBlob and downloadText runtime lifecycle', () => {
  let objectUrlCounter = 0;
  let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    objectUrlCounter = 0;
    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', {
        writable: true, configurable: true, value: vi.fn(),
      });
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true, configurable: true, value: vi.fn(),
      });
    }
    createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:seomi-runtime/${++objectUrlCounter}`
    );
    revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('creates an anchor with object URL, triggers click, and removes it immediately from DOM', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const blob = new Blob(['sample data'], { type: 'text/csv' });

    downloadBlob('audit.csv', blob);

    expect(createObjectUrlSpy).toHaveBeenCalledWith(blob);
    expect(appendSpy).toHaveBeenCalledTimes(1);

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe('A');
    expect(anchor.href).toBe('blob:seomi-runtime/1');
    expect(anchor.download).toBe('audit.csv');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Anchor must be removed from document.body immediately in finally block
    expect(document.body.contains(anchor)).toBe(false);

    // Object URL revocation must NOT happen synchronously
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled();

    // Revocation executes asynchronously to allow WebView download stream to start
    vi.runAllTimers();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:seomi-runtime/1');
  });

  it('guarantees DOM cleanup and URL revocation even when anchor.click() throws', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementationOnce(() => {
      throw new Error('Simulated browser download permission denial');
    });

    const blob = new Blob(['data'], { type: 'text/plain' });
    expect(() => downloadBlob('failed.txt', blob)).toThrow('Simulated browser download permission denial');

    expect(appendSpy).toHaveBeenCalledTimes(1);
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(document.body.contains(anchor)).toBe(false);

    expect(revokeObjectUrlSpy).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:seomi-runtime/1');
  });

  it('manages multiple sequential downloads without element collisions or resource leaks', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    downloadBlob('first.csv', new Blob(['1']));
    downloadBlob('second.csv', new Blob(['2']));

    expect(appendSpy).toHaveBeenCalledTimes(2);
    expect(document.body.children.length).toBe(0);

    vi.runAllTimers();
    expect(revokeObjectUrlSpy).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlSpy).toHaveBeenNthCalledWith(1, 'blob:seomi-runtime/1');
    expect(revokeObjectUrlSpy).toHaveBeenNthCalledWith(2, 'blob:seomi-runtime/2');
  });

  it('downloadText wraps text payload in a UTF-8 Blob and triggers downloadBlob', async () => {
    const textContent = 'col1,col2\r\n"zażółć","gęślą"';
    downloadText('report.csv', textContent, 'text/csv');

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectUrlSpy.mock.calls[0][0] as Blob;

    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/csv;charset=utf-8');

    const readText = await blobArg.text();
    expect(readText).toBe(textContent);

    vi.runAllTimers();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:seomi-runtime/1');
  });

  it('downloadText preserves multiline JSON formatting and mime type', async () => {
    const jsonContent = JSON.stringify({ audit: true, items: [1, 2, 3] }, null, 2);
    downloadText('audit.json', jsonContent, 'application/json');

    const blobArg = createObjectUrlSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json;charset=utf-8');
    expect(await blobArg.text()).toBe(jsonContent);
  });
});
