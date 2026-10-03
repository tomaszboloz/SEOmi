import type { PublicAuditResult } from './auditTypes.js';
import { normalizeCrawlUrl } from './auditScope.js';

const MAX_DISCOVERED_LINKS = 2_000;
const MAX_SEMANTIC_TERMS = 40;
const MAX_SEMANTIC_LINKS = 1_000;
const SEMANTIC_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'have', 'has', 'into', 'your', 'you', 'but',
  'oraz', 'jest', 'są', 'dla', 'z', 'ze', 'do', 'na', 'w', 'we', 'i', 'a', 'to', 'ten', 'ta', 'te', 'jak', 'lub', 'nie',
]);

export const extract = (html: string, expression: RegExp): string[] => Array.from(html.matchAll(expression), (match) => match[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '').filter(Boolean);

export const extractPublicLinks = (html: string, baseUrl: URL): { links: string[]; truncated: boolean } => {
  const links = new Set<string>();
  let truncated = false;
  const expression = /<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1/gi;
  for (const match of html.matchAll(expression)) {
    const raw = match[2]?.trim();
    if (!raw || links.size >= MAX_DISCOVERED_LINKS) {
      if (raw) truncated = true;
      continue;
    }
    try {
      const target = new URL(raw, baseUrl);
      if (!['http:', 'https:'].includes(target.protocol)) continue;
      target.hash = '';
      links.add(normalizeCrawlUrl(target.toString()));
    } catch {
      // Ignore malformed href values; the audit must never invent a URL.
    }
  }
  return { links: [...links], truncated };
};

const isHiddenOrChrome = (attributes: string): boolean => {
  const normalized = attributes.toLocaleLowerCase();
  return /\bhidden\b|\binert\b|aria-hidden\s*=\s*["']?(?:true|1)|role\s*=\s*["']?(?:banner|navigation|contentinfo|complementary|form|search)\b|(?:display|visibility|content-visibility)\s*:\s*hidden|(?:class|id)\s*=\s*(?:["'][^"']*(?:header|nav|footer|sidebar|breadcrumb|cookie|consent|banner)[^"']*["']|[^\s>]*(?:header|nav|footer|sidebar|breadcrumb|cookie|consent|banner)[^\s>]*)/.test(normalized);
};

const removeElementBlocks = (html: string, tags: string): string => html.replace(new RegExp(`<(${tags})\\b([^>]*)>[\\s\\S]*?<\\/\\1>`, 'gi'), ' ');

const removeHiddenBlocks = (html: string): string => {
  let result = html;
  const hiddenBlock = /<([a-z][a-z0-9-]*)\b(?=[^>]*(?:\bhidden\b|\binert\b|aria-hidden\s*=\s*["']?(?:true|1)|role\s*=\s*["']?(?:banner|navigation|contentinfo|complementary|form|search)\b|(?:display|visibility|content-visibility)\s*:\s*hidden|(?:class|id)\s*=\s*(?:["'][^"']*(?:header|nav|footer|sidebar|breadcrumb|cookie|consent|banner)[^"']*["']|[^\s>]*(?:header|nav|footer|sidebar|breadcrumb|cookie|consent|banner)[^\s>]*)))[^>]*>[\s\S]*?<\/\1\s*>/gi;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = result.replace(hiddenBlock, ' ');
    if (next === result) break;
    result = next;
  }
  return result.replace(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi, (full, _tag, attributes) => (
    isHiddenOrChrome(attributes || '') ? ' ' : full
  ));
};

export const decodeText = (value: string): string => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'");

export const extractSemanticSignals = (html: string, baseUrl: URL): {
  terms: string[];
  links: string[];
  source: PublicAuditResult['semantic_content_source'];
} => {
  const withoutRuntime = removeElementBlocks(html, 'script|style|noscript|template|svg');
  const primaryCandidates = [...withoutRuntime.matchAll(/<(main|article)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)]
    .filter((match) => !isHiddenOrChrome(match[2] || ''));
  const source = primaryCandidates[0]?.[3] ? 'primary-root' : 'body-fallback';
  const selected = primaryCandidates[0]?.[3] || withoutRuntime;
  const content = removeHiddenBlocks(removeElementBlocks(selected, 'header|nav|footer|aside|form'));
  const text = decodeText(content.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!text) return { terms: [], links: [], source: 'unavailable' };
  const counts = new Map<string, number>();
  for (const token of text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) || []) {
    if (SEMANTIC_STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  const terms = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_SEMANTIC_TERMS)
    .map(([term]) => term);
  const links = extractPublicLinks(content, baseUrl).links.slice(0, MAX_SEMANTIC_LINKS);
  return { terms, links, source };
};
