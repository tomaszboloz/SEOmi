import type { PageAuditData } from '@/types';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri/transport';
import { SOURCE_TEXT_LIMIT, type BodyAvailability, type SourceEvidence } from './sources';
import { waitForSourceSlot } from './sourcePacer';

export const SOURCE_TIMEOUT_MS = 18_000;
const availabilityOf = (error: unknown): BodyAvailability => {
  const message = String(error);
  if (/too large|too-large|body.*(?:limit|exceed)|response.*(?:limit|exceed)/iu.test(message)) return 'too-large';
  if (/private|public|blocked|forbidden|validation|reserved|loopback|localhost|not allowed/iu.test(message)) return 'blocked';
  return 'unavailable';
};

export const fetchSource = async (source: SourceEvidence, signal: AbortSignal): Promise<SourceEvidence> => {
  signal.throwIfAborted();
  if (!isTauriEnvironment()) return { ...source, fetchedAt: new Date().toISOString(), availability: 'unavailable', text: '', vector: null };
  await waitForSourceSlot(signal);
  signal.throwIfAborted();
  const requestId = `offpage-${crypto.randomUUID()}`;
  const cancel = () => { void invokeTauriCommand('cancel_inspect_url', { requestId }).catch(() => undefined); };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop!: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    stop = () => { cancel(); reject(new Error('Cancelled')); };
    signal.addEventListener('abort', stop, { once: true });
    timer = setTimeout(() => { cancel(); reject(new Error('Timeout')); }, SOURCE_TIMEOUT_MS);
  });
  try {
    const audit = await Promise.race([invokeTauriCommand<PageAuditData>('inspect_url', {
      url: source.sourceUrl, requestId, timeoutSecs: 15, maxRedirects: 5, verifySsl: true,
    }), interrupted]);
    signal.throwIfAborted();
    const text = audit.http_status >= 200 && audit.http_status < 300
      ? (audit.content_stats.body_text ?? '').slice(0, SOURCE_TEXT_LIMIT).trim() : '';
    return { ...source, fetchedAt: new Date().toISOString(), availability: text ? 'ok' : 'unavailable', text };
  } catch (error) {
    signal.throwIfAborted();
    return { ...source, fetchedAt: new Date().toISOString(), availability: availabilityOf(error), text: '', vector: null };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', stop);
  }
};
