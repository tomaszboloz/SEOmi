import type { AiProvider } from '@/types';

export interface AiResearchSettings {
  prompts: string[];
  competitors: string[];
  repetitions: number;
}

export const emptyAiResearchSettings = (): AiResearchSettings => ({ prompts: [], competitors: [], repetitions: 1 });
export const normalizeAiResearchSettings = (value: Partial<AiResearchSettings> | null): AiResearchSettings => ({
  prompts: [...new Set((Array.isArray(value?.prompts) ? value.prompts : []).filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, 10),
  competitors: [...new Set((Array.isArray(value?.competitors) ? value.competitors : []).filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, 20),
  repetitions: Math.max(1, Math.min(5, Math.floor(Number(value?.repetitions) || 1))),
});

export const redactLocalContext = (value: string): string => value
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
  .replace(/(?:\/Users\/|\/home\/|C:\\Users\\)[^\s'"`]+/g, '[redacted local path]')
  .replace(/(?:^|\s)~\/[^\s'"`]+/g, ' [redacted local path]');

const normalizedText = (value: string) => value.normalize('NFKC').toLocaleLowerCase();
const domainHost = (value: string): string => {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  } catch { return ''; }
};
export const extractAiCitations = (response: string): string[] => [...new Set(
  (response.match(/https?:\/\/[^\s<>"`]+/g) || []).map((value) => value.replace(/[\]),.;!?]+$/, '')).filter((value) => {
    try { const url = new URL(value); return !url.username && !url.password; } catch { return false; }
  }),
)];
export const citesOwnDomain = (citations: string[], domain: string): boolean => {
  const own = domainHost(domain);
  return Boolean(own && citations.some((citation) => {
    const host = domainHost(citation);
    return host === own || host.endsWith(`.${own}`);
  }));
};

// Require a complete name, rather than substrings such as "SEO" in "SEOmi".
export const mentionOffset = (response: string, name: string): number => {
  const needle = normalizedText(name.trim());
  if (!needle) return -1;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'u').exec(normalizedText(response));
  return match ? match.index + match[1].length : -1;
};
export const isUnbrandedPrompt = (prompt: string, brand: string, domain: string): boolean =>
  mentionOffset(prompt, brand) < 0 && (!domainHost(domain) || mentionOffset(prompt, domainHost(domain)) < 0);

export const aiSearchMode = (provider: AiProvider): 'web_enabled' | 'model_knowledge' => provider === 'claude' ? 'web_enabled' : 'model_knowledge';

export const analyzeAiEvidence = (response: string, brand: string, domain: string, competitors: string[], prompt = '') => {
  const citations = extractAiCitations(response);
  const ownDomainCited = citesOwnDomain(citations, domain);
  const evidence = response.split(/(?<=[.!?])\s+|\n/).filter((sentence) => {
    if (prompt && normalizedText(sentence.trim()) === normalizedText(prompt.trim())) return false;
    return !/\b(i\s*(do not|don't|cannot|can't|am unable)|unable to|could not|no sources?|not enough information|not determine|not known|blocked)\b|nie (wiem|znam|mogę)|brak (danych|informacji)/i.test(sentence);
  }).join('\n');
  const matches = [brand, ...competitors].filter((name, index, all) => name.trim() && all.findIndex((other) => normalizedText(other) === normalizedText(name)) === index)
    .map((name) => ({ name, offset: mentionOffset(evidence, name) })).filter((item) => item.offset >= 0).sort((a, b) => a.offset - b.offset);
  const brandIndex = matches.findIndex((item) => normalizedText(item.name) === normalizedText(brand));
  const ownHost = domainHost(domain);
  const escapedHost = ownHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const domainMentioned = Boolean(ownHost && new RegExp(`(^|[^\\p{L}\\p{N}.-])${escapedHost}(?=$|[^\\p{L}\\p{N}.-])`, 'u').test(normalizedText(evidence)));
  const brandMentioned = citesOwnDomain(extractAiCitations(evidence), domain) || (brandIndex >= 0 && (!ownHost || domainMentioned));
  return {
    citations,
    ownDomainCited,
    brandMentioned,
    // Position amongst the tracked brands in order of first textual appearance.
    mentionPosition: brandMentioned && brandIndex >= 0 ? brandIndex + 1 : null,
    brandMentions: [...new Set([...matches.filter((item) => normalizedText(item.name) !== normalizedText(brand) || brandMentioned).map((item) => item.name), ...(brandMentioned && brand.trim() ? [brand] : [])])],
    competitorsMentioned: matches.filter((item) => normalizedText(item.name) !== normalizedText(brand)).map((item) => item.name),
  };
};
