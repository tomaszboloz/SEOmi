import { runAiBrief, type BriefTextDeps } from '@/services/aiBriefRunner';
import { buildBriefPrompt, buildRewriteBrief, type CoreTopic, type PageFocus, type RewriteBrief } from '@/services/siteFocus';

export type BriefDeps = BriefTextDeps;

export type BriefOutcome =
  | { status: 'ok'; text: string; brief: RewriteBrief; cached: boolean }
  | { status: 'no-key' }
  | { status: 'empty' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const MAX_CHARS = 8000;
const cache = new Map<string, { prompt: string; text: string }>();

export const clearBriefCache = (): void => cache.clear();

const TAG = /<\/?[a-z][^>]*>/gi;

/** Removes tags until none remain, so nested input such as `<scr<script>ipt>` cannot rebuild one. */
const stripTags = (text: string): string => {
  let out = text;
  for (let prev = ''; prev !== out; ) {
    prev = out;
    out = out.replace(TAG, '');
  }
  return out.replace(/[<>]/g, '');
};

/** Strips fences, markup and control characters from model output; the text is shown as plain text. */
export const sanitizeBrief = (raw: string): string =>
  stripTags(
    raw
      .replace(/^```[a-z]*\s*$/gim, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''),
  )
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS);

/** AI rewrite brief for an off-topic page; results are cached in memory per URL while the prompt is unchanged. */
export const generateRewriteBrief = async (deps: BriefDeps, page: PageFocus, core: CoreTopic, options: { signal?: AbortSignal; force?: boolean } = {}): Promise<BriefOutcome> => {
  const brief = buildRewriteBrief(page, core);
  const outcome = await runAiBrief({ deps, prompt: buildBriefPrompt(brief), sanitize: sanitizeBrief, signal: options.signal, cache: { store: cache, key: page.url, force: options.force } });
  return outcome.status === 'ok' ? { ...outcome, brief } : outcome;
};
