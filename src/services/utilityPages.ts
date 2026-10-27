/**
 * One dictionary of utility pages (legal, account, contact, careers, press,
 * ads, cart) shared by the Site Focus page typing and the topical diagnosis
 * roles. Footer and navigation pages are linked from everywhere, so inlinks say
 * nothing about their topic.
 */
const UTILITY_SEGMENTS = [
  'privacy[a-z-]*', 'polityka[a-z-]*', 'politica[a-z-]*', 'regulamin[a-z-]*', 'terms[a-z-]*',
  'cookies?[a-z-]*', 'rodo', 'gdpr', 'impressum', 'datenschutz', 'mentions-legales', 'aviso-legal',
  'kontakt[a-z-]*', 'contact[a-z-]*', 'o-nas', 'about-us', 'kariera', 'careers?', 'jobs?',
  'press(-pack)?', 'media', 'dla-mediow', 'reklama', 'advertis(e|ing)', 'faq',
  'login', 'logowanie', 'sign-in', 'register', 'rejestracja', 'my-account', 'moje-konto',
  'koszyk', 'cart', 'checkout', 'mapa-strony', 'sitemap', '404',
];

const alternation = UTILITY_SEGMENTS.join('|');

/** Matches one whole (diacritic-folded, lowercase) URL segment. */
export const UTILITY_SEGMENT_PATTERN = new RegExp(`^(${alternation})$`);

/** Matches a utility segment anywhere in a pathname. */
export const UTILITY_PATH_PATTERN = new RegExp(`(^|/)(${alternation})(/|$)`, 'i');
