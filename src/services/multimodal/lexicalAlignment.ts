import type { AlignmentArtifact, ModelInput, ModelProvider } from './modelProviders';

/**
 * Deterministic stand-in for CLIP alignment (#96 GEM-96-04). It reads no pixels: it scores the lexical
 * overlap between the ALT text plus the file name and the surrounding paragraph. Confidence is always
 * null, so the result stays `partial` and must never be presented as image understanding.
 */
export const LEXICAL_ALIGNMENT_PROVIDER = 'lexical-heuristic';
const words = (text: string): Set<string> => new Set(text.normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
const fileWords = (url: string): string => { try { return (new URL(url).pathname.split('/').pop() as string).replace(/\.[a-z0-9]+$/iu, '').replace(/[-_]+/gu, ' '); } catch { return ''; } };

export const createLexicalAlignmentProvider = (now: () => string = () => new Date().toISOString()): ModelProvider<'clip-alignment'> => ({
  analysis: 'clip-alignment',
  id: LEXICAL_ALIGNMENT_PROVIDER,
  analyze: async (input: ModelInput): Promise<AlignmentArtifact> => {
    const alt = input.context?.alt?.trim() ?? '';
    const left = words(`${alt} ${fileWords(input.url)}`);
    const right = words(input.context?.paragraph ?? '');
    if (!left.size || !right.size) throw new Error('No text to compare');
    const shared = [...left].filter((word) => right.has(word)).length;
    return {
      similarity: shared / left.size, dimension: left.size, textSource: alt ? 'alt' : 'paragraph',
      provenance: { provider: LEXICAL_ALIGNMENT_PROVIDER, model: 'token-overlap', modelVersion: '1', language: null, confidence: null, sourceUrl: input.url, contentHash: input.contentHash, analyzedAt: now() },
    };
  },
});
