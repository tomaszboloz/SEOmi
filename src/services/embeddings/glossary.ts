import { contentStems } from './text.ts';

/**
 * Maps words and phrases (any language) to shared concept names, so a Polish
 * and an English query about the same thing share a feature even when they
 * share no word. Extend it with domain vocabulary to raise accuracy; measure
 * every change with `npm run embeddings -- eval`.
 */
export type Glossary = Record<string, string[]>;

export const SEO_GLOSSARY: Glossary = {
  speed: ['speed', 'szybkosc', 'szybki', 'przyspieszenie', 'ladowanie', 'wydajnosc', 'pagespeed', 'core web vitals', 'lcp', 'inp', 'cls', 'ttfb', 'largest contentful paint', 'layout shift', 'slow', 'wolno'],
  redirect: ['redirect', 'przekierowanie', 'przekierowan', '301', '302', 'htaccess', 'meta refresh'],
  backlink: ['backlink', 'link zwrotny', 'linki zwrotne', 'link building', 'referring domains', 'disavow', 'outreach'],
  keyword: ['keyword', 'slowo kluczowe', 'slowa kluczowe', 'fraza kluczowa', 'frazy', 'long tail', 'dlugi ogon', 'search volume'],
  sitemap: ['sitemap', 'mapa strony', 'mapa witryny', 'mapie witryny'],
  robots: ['robots', 'robots txt', 'disallow', 'user agent', 'crawl delay'],
  canonical: ['canonical', 'kanoniczny', 'kanonicznym', 'duplicate', 'duplikat', 'zduplikowana', 'duplikacja'],
  hreflang: ['hreflang', 'wielojezyczny', 'multilingual', 'wersje jezykowe', 'x default', 'international'],
  schema: ['schema', 'structured data', 'dane strukturalne', 'json ld', 'rich results', 'rich snippet'],
  meta: ['meta title', 'title tag', 'meta description', 'meta opis', 'opis strony'],
};

export interface CompiledGlossary {
  /** Concepts whose terms (as stem sequences) occur in the text. */
  concepts(stems: string[]): string[];
}

/** Compiles terms to stem sequences once; matching is then a linear scan. */
export const compileGlossary = (glossary: Glossary): CompiledGlossary => {
  const entries = Object.entries(glossary).flatMap(([concept, terms]) =>
    terms.map((term) => ({ concept, stems: contentStems(term) })).filter((entry) => entry.stems.length > 0));
  return {
    concepts(stems: string[]) {
      const found = new Set<string>();
      for (const { concept, stems: term } of entries) {
        if (found.has(concept)) continue;
        for (let start = 0; start + term.length <= stems.length; start += 1) {
          if (term.every((part, offset) => stems[start + offset] === part)) {
            found.add(concept);
            break;
          }
        }
      }
      return [...found];
    },
  };
};
