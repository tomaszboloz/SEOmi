import { normalizeUrl } from '@/services/siteFocus/pageType';
import { blendSimilarity, pageVectorFrom, safeCosine } from '@/services/semanticSource/similarity';
import type { EmbeddingSet } from '@/services/semanticSource/types';
import type { SemanticPageNode } from '@/services/semanticGraph/types';

/**
 * simPage for one edge (#71 GEM-71-02, #86): the lexical weighted Jaccard stays the deterministic default.
 * With an optional shared embedding set the cosine of both page vectors is blended in (mean, same rule
 * as Site Focus); when only the vectors are known, the cosine alone stands in for the missing lexical edge.
 * Unknown vectors never invent a value: the result stays `undefined` and the edge stays unmeasured.
 */
export const edgePageSimilarity = (
  lexical: number | undefined, source: SemanticPageNode, target: SemanticPageNode, embeddings?: EmbeddingSet,
): number | undefined => {
  const vector = (node: SemanticPageNode) => pageVectorFrom(embeddings, normalizeUrl(node.page.final_url || node.page.url));
  const left = vector(source);
  const right = vector(target);
  const cosine = left && right ? safeCosine(left, right) : null;
  if (cosine === null) return lexical;
  return lexical === undefined ? Math.max(0, cosine) : blendSimilarity(lexical, cosine);
};
