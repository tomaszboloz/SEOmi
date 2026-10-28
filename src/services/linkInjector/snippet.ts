import type { CrawledPageSummary } from '@/types';

/** Sentence frames in the donor page's language; this is page content, not UI copy. */
const FRAMES = {
  en: 'See also: {link}.', pl: 'Zobacz też: {link}.', de: 'Siehe auch: {link}.', es: 'Consulta también: {link}.',
  fr: 'Voir aussi : {link}.', it: 'Vedi anche: {link}.', pt: 'Veja também: {link}.', ru: 'См. также: {link}.',
  ja: '関連情報：{link}', zh: '另请参阅：{link}', ko: '함께 보기: {link}', ar: 'اقرأ أيضًا: {link}.',
} as const;
export type SnippetLanguage = keyof typeof FRAMES;
const MAX_ANCHOR = 70;

/** Page language from the document, then the detected semantic language; unknown falls back to English and says so. */
export const snippetLanguage = (page: Pick<CrawledPageSummary, 'document_language' | 'semantic_language'>): { language: SnippetLanguage; fallback: boolean } => {
  for (const raw of [page.document_language, page.semantic_language]) {
    const code = (raw ?? '').trim().toLowerCase().split(/[-_]/)[0];
    if (Object.hasOwn(FRAMES, code)) return { language: code as SnippetLanguage, fallback: false };
  }
  return { language: 'en', fallback: true };
};

/** Target title cut at a word boundary, so the anchor stays descriptive without an ellipsis. */
export const anchorText = (title: string): string => {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_ANCHOR) return clean;
  const cut = clean.slice(0, MAX_ANCHOR);
  const space = cut.lastIndexOf(' ');
  return (space > MAX_ANCHOR / 2 ? cut.slice(0, space) : cut).trim();
};

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const escapeMarkdown = (value: string): string => value.replace(/([\\[\]*_`])/g, '\\$1');
const markdownUrl = (value: string): string => value.replace(/[()\s<>]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);

export interface InjectionSnippet { language: SnippetLanguage; languageFallback: boolean; anchor: string; html: string; markdown: string }

export const buildSnippet = (donor: CrawledPageSummary, targetUrl: string, targetTitle: string): InjectionSnippet => {
  const { language, fallback } = snippetLanguage(donor);
  const anchor = anchorText(targetTitle) || targetUrl;
  const [before, after] = FRAMES[language].split('{link}');
  return {
    language, languageFallback: fallback, anchor,
    html: `<p>${escapeHtml(before)}<a href="${escapeHtml(targetUrl)}">${escapeHtml(anchor)}</a>${escapeHtml(after)}</p>`,
    markdown: `${escapeMarkdown(before)}[${escapeMarkdown(anchor)}](${markdownUrl(targetUrl)})${escapeMarkdown(after)}`,
  };
};
