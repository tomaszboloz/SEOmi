import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri/transport';
import { browserImageSource, type ImageByteSource, type ImageFetch } from './imageBytes';

interface NativeDownload { finalUrl: string; contentType: string; base64: string }

const decode = (base64: string, type: string): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
};

const failure = (message: string): ImageFetch => ({
  ok: false,
  failure: /not a raster/iu.test(message) ? 'not-image' : /safety limit/iu.test(message) ? 'too-large'
    : /Invalid|Unsafe|Unsupported scheme|Missing host|not allowed|blocked for security/iu.test(message) ? 'unsupported-url' : /HTTP \d/u.test(message) ? 'http-error' : 'blocked',
});

/**
 * Desktop image source (#96): the Rust command downloads public raster images with pinned DNS, no
 * cookies and a 5 MB cap, so hosts without CORS headers no longer end up "blocked". Outside the
 * desktop app it falls back to the CORS fetch source.
 */
export const nativeImageSource = (fallback: ImageByteSource = browserImageSource(), isDesktop: () => boolean = isTauriEnvironment): ImageByteSource => ({
  id: 'native-rust-fetch',
  fetch: async (url, signal) => {
    if (!isDesktop()) return fallback.fetch(url, signal);
    signal.throwIfAborted();
    try {
      const download = await invokeTauriCommand<NativeDownload>('fetch_image_bytes', { url });
      signal.throwIfAborted();
      return { ok: true, bytes: decode(download.base64, download.contentType), contentType: download.contentType };
    } catch (error) {
      signal.throwIfAborted();
      return failure(String(error));
    }
  },
});
