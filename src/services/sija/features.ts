import type { PageFeatures } from './types';

const IGNORED_CONTENT = 'nav, header, footer, aside, style, noscript, template, [role="navigation"], [role="banner"], [role="contentinfo"]';
const CHROME = `${IGNORED_CONTENT}, script`;
const CALC = /calculat|kalkulator|rechner|calculadora|calculatrice|calcolatrice|计算|計算|계산|калькулятор/i;
const LOCAL_TEXT = /near me|opening hours|w pobliżu|godziny otwarcia|öffnungszeiten|horario de apertura|horaires d'ouverture|orari di apertura/i;
const PRICE = /(?:[$€£]|zł|pln|eur|usd)\s?\d|\d\s?(?:[$€£]|zł|pln|eur|usd)(?![\p{L}])/iu;

const schemaUrl = (value: string): URL | null => {
  try {
    const parsed = new URL(value);
    const authorityStart = value.indexOf('//');
    const authority = authorityStart >= 0 ? value.slice(authorityStart + 2).split(/[/?#]/u, 1)[0] : '';
    if (!['http:', 'https:'].includes(parsed.protocol) || !['schema.org', 'www.schema.org'].includes(parsed.hostname.toLowerCase()) || parsed.username || parsed.password || parsed.port || authority.includes(':')) return null;
    return parsed;
  } catch {
    return null;
  }
};

const schemaTypeFromUrl = (value: string): string | null => {
  const parsed = schemaUrl(value);
  if (!parsed || parsed.search || parsed.hash) return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  return parts.length === 1 ? parts[0] : null;
};

const isSchemaContext = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(isSchemaContext);
  if (value && typeof value === 'object') return Object.values(value).some(isSchemaContext);
  if (typeof value !== 'string') return false;
  const parsed = schemaUrl(value);
  return Boolean(parsed && !parsed.search && !parsed.hash && (parsed.pathname === '/' || parsed.pathname === ''));
};

const hasSchemaType = (root: ParentNode, wanted: string): boolean => {
  const nodes = [...root.querySelectorAll('[itemtype], script[type="application/ld+json"]')].filter((el) => !el.closest(IGNORED_CONTENT));
  if (nodes.some((el) => el.matches('[itemtype]') && (el.getAttribute('itemtype') ?? '').split(/\s+/u).some((value) => schemaTypeFromUrl(value) === wanted))) return true;
  const hasJsonType = (value: unknown, inheritedContext = false): boolean => {
    if (Array.isArray(value)) return value.some((entry) => hasJsonType(entry, inheritedContext));
    if (!value || typeof value !== 'object') return false;
    const object = value as Record<string, unknown>;
    const schemaContext = inheritedContext || isSchemaContext(object['@context']);
    const rawTypes = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
    if (rawTypes.some((type) => typeof type === 'string' && (schemaTypeFromUrl(type) === wanted || (schemaContext && type === wanted)))) return true;
    return Object.values(object).some((entry) => hasJsonType(entry, schemaContext));
  };
  return nodes.filter((el) => el.matches('script[type="application/ld+json"]')).some((script) => {
    try { return hasJsonType(JSON.parse(script.textContent ?? '')); } catch { return false; }
  });
};

/** Extracts structural features from parsed HTML. Navigation, header, footer and sidebars are ignored. */
export const extractFeatures = (doc: Document): PageFeatures => {
  const root = doc.body.cloneNode(true) as HTMLElement;
  const hasLocalSchema = hasSchemaType(doc, 'LocalBusiness') || hasSchemaType(doc, 'PostalAddress');
  root.querySelectorAll(CHROME).forEach((node) => node.remove());
  const count = (selector: string) => root.querySelectorAll(selector).length;
  const text = root.textContent as string;
  const heads = [...root.querySelectorAll('h1, h2, h3')];
  const formInputs = count('form input:not([type="hidden"]):not([type="submit"]), form select, form textarea');
  const calculators = [...root.querySelectorAll('form, [class], [id]')].filter((el) => CALC.test(`${el.id} ${el.getAttribute('class') ?? ''}`) && el.querySelector('input, select')).length;
  const schema = root.innerHTML.match(/https?:\/\/(?:www\.)?schema\.org\/(?:Product|Offer)\b/g)?.length ?? 0;
  const priced = [...root.querySelectorAll('[class*="product"], [class*="price"], [data-price]')].filter((el) => PRICE.test(el.textContent as string) || el.hasAttribute('data-price')).length;
  const local = count('a[href^="tel:"], iframe[src*="maps"], address') + (hasLocalSchema ? 1 : 0) + (LOCAL_TEXT.test(text) ? 1 : 0);
  return {
    tables: count('table'), orderedLists: count('ol'), unorderedLists: count('ul'), formInputs, calculators,
    productCards: Math.max(schema, priced), localSignals: local,
    words: (text.match(/[\p{L}\p{N}]+/gu) ?? []).length, headings: heads.length,
    headingText: heads.map((h) => h.textContent as string).join(' | '),
  };
};

export const parseFeatures = (html: string): PageFeatures => extractFeatures(new DOMParser().parseFromString(html, 'text/html'));
