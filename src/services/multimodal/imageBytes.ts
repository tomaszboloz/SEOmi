import type { GrayImage } from './phash';

/**
 * Image byte sources for perceptual hashing (#96). A source returns the raw bytes of one image or a typed
 * failure; it never invents pixels. The built-in browser source uses CORS fetch, so images whose server does
 * not allow cross-origin reads stay "blocked" rather than being guessed. Other sources (a native fetcher,
 * a local folder) can implement the same interface later.
 */
export type ImageFailure = 'blocked' | 'http-error' | 'too-large' | 'not-image' | 'decode-failed' | 'unsupported-url';
export type ImageFetch = { ok: true; bytes: Blob; contentType: string } | { ok: false; failure: ImageFailure };
export interface ImageByteSource { id: string; fetch: (url: string, signal: AbortSignal) => Promise<ImageFetch> }
export type ImageDecoder = (bytes: Blob) => Promise<GrayImage | null>;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DECODE_EDGE = 256;

export const browserImageSource = (fetchImpl: typeof fetch = (...args) => fetch(...args)): ImageByteSource => ({
  id: 'browser-cors-fetch',
  fetch: async (url, signal) => {
    let parsed: URL;
    try { parsed = new URL(url); } catch { return { ok: false, failure: 'unsupported-url' }; }
    if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, failure: 'unsupported-url' };
    let response: Response;
    try {
      response = await fetchImpl(parsed.href, { mode: 'cors', credentials: 'omit', redirect: 'follow', signal });
    } catch {
      signal.throwIfAborted();
      return { ok: false, failure: 'blocked' };
    }
    if (!response.ok) return { ok: false, failure: 'http-error' };
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') return { ok: false, failure: 'not-image' };
    if (Number(response.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return { ok: false, failure: 'too-large' };
    const bytes = await response.blob();
    return bytes.size > MAX_IMAGE_BYTES ? { ok: false, failure: 'too-large' } : { ok: true, bytes, contentType };
  },
});

/** Decodes with createImageBitmap and a small canvas; luminance per ITU-R BT.601. Null when the browser cannot decode. */
export const canvasDecoder: ImageDecoder = async (bytes) => {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(bytes);
    const scale = Math.min(1, DECODE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const { data } = context.getImageData(0, 0, width, height);
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < gray.length; i += 1) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    return { width, height, gray };
  } catch {
    return null;
  }
};

export const sha256Hex = async (bytes: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await bytes.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
