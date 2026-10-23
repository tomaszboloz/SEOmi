import { CmsError } from './types';

interface Heading { start: number; end: number; level: number; text: string }

const stripTags = (html: string): string => {
  let out = html;
  for (let prev = ''; prev !== out;) { prev = out; out = out.replace(/<[^>]*>/g, ''); }
  return out.replace(/[<>]/g, '');
};

const plain = (html: string): string => stripTags(html).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const findHeadings = (content: string): Heading[] => {
  const found: Heading[] = [];
  for (const m of content.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    found.push({ start: m.index, end: m.index + m[0].length, level: Number(m[1]), text: plain(m[2]) });
  }
  for (const m of content.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*$/gm)) {
    found.push({ start: m.index, end: m.index + m[0].length, level: m[1].length, text: m[2].trim() });
  }
  return found.sort((a, b) => a.start - b.start);
};

export interface SectionPatch { content: string; before: string; after: string }

/**
 * Replaces ONLY the body of the section under `heading` (up to the next heading of the same or higher level).
 * Everything else, including the heading itself, is returned byte for byte.
 */
export const patchSection = (content: string, heading: string, replacement: string): SectionPatch => {
  const headings = findHeadings(content);
  const wanted = plain(heading);
  const hits = headings.filter((h) => h.text === wanted);
  if (!hits.length) throw new CmsError('heading-not-found', `Heading not found: ${wanted}`);
  if (hits.length > 1) throw new CmsError('heading-ambiguous', `Heading is not unique: ${wanted}`);
  const hit = hits[0];
  const next = headings.find((h) => h.start > hit.start && h.level <= hit.level);
  const bodyEnd = next ? next.start : content.length;
  const before = content.slice(hit.end, bodyEnd);
  const lead = before.slice(0, before.length - before.trimStart().length);
  const trail = before.slice(before.trimEnd().length);
  const after = `${lead || '\n'}${replacement.trim()}${next ? trail || '\n' : trail}`;
  return { content: content.slice(0, hit.end) + after + content.slice(bodyEnd), before, after };
};
