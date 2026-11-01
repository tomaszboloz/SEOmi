import { normalizeUrl } from '@/services/siteFocus/pageType';

export interface TextPage {
  url: string;
  final_url?: string | null;
  title?: string | null;
  meta_description?: string | null;
  heading_texts?: { h1?: string[] } | null;
}

export const MAX_PAGE_TEXT_CHARS = 600;

/** Short page text (title, first H1, meta description) keyed like the analyses key vectors. Empty pages are left out. */
export const pageTexts = (pages: readonly TextPage[]): Map<string, string> => {
  const out = new Map<string, string>();
  pages.forEach((page) => {
    const text = [page.title, page.heading_texts?.h1?.[0], page.meta_description]
      .map((part) => part?.trim() ?? '').filter(Boolean).join('. ').slice(0, MAX_PAGE_TEXT_CHARS);
    if (text) out.set(normalizeUrl(page.final_url || page.url), text);
  });
  return out;
};
