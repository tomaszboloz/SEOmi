import { gateFacts, isLocalProvider } from '@/services/llmEconomy';
import { buildPatchPrompt } from './prompt';
import type { PatchProposal, PatchResult, PatchTarget } from './types';

/** One configured AI backend. `generate` is the existing provider abstraction (AIService.generateText) bound to credentials. */
export interface PatchProvider {
  id: string;
  /** Deprecated caller hint; transport is derived from the provider id. */
  local?: boolean;
  /** Explicit transport may only make a known local provider remote. */
  transport?: 'local' | 'cloud';
  generate: (prompt: string) => Promise<string>;
}

/** Per-session cache keyed by provider + prompt, so an identical request never pays twice. */
export type PatchCache = Map<string, string>;

/** Local provider first (nothing leaves the device); otherwise the first configured one. */
export const choosePatchProvider = (providers: PatchProvider[]): PatchProvider | null =>
  providers.find((provider) => isLocalProvider(provider.id) && provider.transport !== 'cloud') ?? providers[0] ?? null;

const providerIsLocal = (provider: PatchProvider): boolean =>
  isLocalProvider(provider.id) && provider.transport !== 'cloud';

const stripHtml = (text: string): string => {
  let out = text;
  for (let prev = ''; prev !== out;) { prev = out; out = out.replace(/<[^>]+>/g, ''); }
  return out.replace(/[<>]/g, '');
};

/** Removes fences, HTML and wrapper quotes the model may add around a plain-text paragraph. */
export const sanitizePatch = (raw: string): string =>
  stripHtml(raw.replace(/```[a-z]*\n?|```/gi, '')).replace(/^\s*"""|"""\s*$/g, '').replace(/\s+/g, ' ').trim();

const abortable = <T,>(work: Promise<T>, signal?: AbortSignal): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException('aborted', 'AbortError'));
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal?.removeEventListener('abort', abort));
  });

export interface RunOptions { signal?: AbortSignal; cache?: PatchCache }

/**
 * Generates a before/after proposal. Numbers with units that the original paragraph does not contain
 * are removed by the fact gate. The proposal is always `pending`: a person approves it with `decide`.
 */
export const proposePatch = async (target: PatchTarget, providers: PatchProvider[], options: RunOptions = {}): Promise<PatchResult> => {
  const provider = choosePatchProvider(providers);
  if (!provider) return { ok: false, reason: 'no-provider' };
  const prompt = buildPatchPrompt(target);
  const key = `${provider.id}\u0000${prompt}`;
  const cached = options.cache?.get(key);
  try {
    const raw = cached ?? (await abortable(provider.generate(prompt), options.signal));
    const clean = sanitizePatch(raw);
    if (!clean) return { ok: false, reason: 'empty-response' };
    if (cached === undefined) options.cache?.set(key, raw);
    const gate = gateFacts(clean, [target.paragraph]);
    const proposal: PatchProposal = {
      before: target.paragraph, after: gate.accepted.join(' '), status: 'pending',
      rejectedSentences: gate.rejected.map((item) => item.sentence), leftDevice: !providerIsLocal(provider), fromCache: cached !== undefined,
    };
    return proposal.after ? { ok: true, proposal } : { ok: false, reason: 'empty-response' };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { ok: false, reason: 'aborted' };
    return { ok: false, reason: 'provider-error', detail: error instanceof Error ? error.message : String(error) };
  }
};

/** Only a person calls this; nothing else changes `status`. */
export const decide = (proposal: PatchProposal, approved: boolean): PatchProposal => ({ ...proposal, status: approved ? 'approved' : 'rejected' });
