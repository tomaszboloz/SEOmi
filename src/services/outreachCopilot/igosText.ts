import type { CrawledPageSummary } from '@/types';
import { isHttpSourceUrl } from './source';
import type { TargetChunk } from '@/services/igos/types';

export interface OutreachPageInput { source: CrawledPageSummary; text: string }

export const OUTREACH_TEXT_LIMIT = 12_000;
export const OUTREACH_PASSAGE_LIMIT = 1_000;

const TOKEN = /\p{L}[\p{L}\p{N}'’-]{2,}/gu;

export const boundedOutreachText = (value: string, limit = OUTREACH_TEXT_LIMIT): string => {
  const text = value.trim();
  const characters = Array.from(text);
  return characters.length > limit ? characters.slice(0, limit).join('') : text;
};

export const outreachTokens = (value: string): string[] =>
  value.normalize('NFKC').toLocaleLowerCase().match(TOKEN) ?? [];

export const termCounts = (value: string): Map<string, number> => {
  const counts = new Map<string, number>();
  outreachTokens(value).forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1));
  return counts;
};

export const pageUrl = (page: CrawledPageSummary): string => {
  const candidate = (page.final_url || page.url || '').trim();
  return isHttpSourceUrl(candidate) ? candidate : '';
};

export const pageTitle = (page: CrawledPageSummary): string => {
  const headings = page.heading_texts;
  return (page.title?.trim() || headings?.h1?.[0]?.trim() || headings?.h2?.[0]?.trim() || headings?.h3?.[0]?.trim() || '');
};

export const pageSummary = (text: string): string => boundedOutreachText(text, 600);

const siteHost = (value: string): string => {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./u, ''); } catch { return ''; }
};

export const belongsToSite = (url: string, site: string): boolean => {
  const host = siteHost(url);
  const root = siteHost(site);
  return !!host && !!root && (host === root || host.endsWith(`.${root}`));
};

export const targetChunks = (page: CrawledPageSummary, text: string): Array<Omit<TargetChunk, 'vector'>> => {
  const sections = (page.rag_sections ?? []).flatMap((section) => section.paragraphs
    .map((paragraph) => ({ text: paragraph.trim(), heading: section.heading.trim() || null }))
    .filter((item) => item.text));
  const parts = sections.length ? sections : boundedOutreachText(text).split(/\n{2,}|\n/u)
    .map((part) => ({ text: part.trim(), heading: null }))
    .filter((item) => item.text);
  let offset = 0;
  return parts.map((part) => {
    const chunk = { ...part, offset };
    offset += part.text.length + 1;
    return chunk;
  });
};

export const passages = (value: string): string[] => {
  const text = boundedOutreachText(value);
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const boundary = Math.min(start + OUTREACH_PASSAGE_LIMIT, text.length);
    const space = text.lastIndexOf(' ', boundary);
    const stop = boundary < text.length && space > start ? space : boundary;
    const chunk = text.slice(start, stop).trim();
    if (chunk) chunks.push(chunk);
    start = stop;
  }
  return chunks;
};
