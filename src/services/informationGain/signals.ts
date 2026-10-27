const UNITS = [
  '%', '‰', 'mg/dl', 'mmol/l', 'mg', 'mcg', 'µg', 'kg', 'g', 'km', 'm', 'cm', 'mm', 'ms', 's', 'min', 'h', 'hz', 'khz', 'mhz', 'ghz',
  'gb', 'mb', 'tb', 'kb', 'kcal', 'kj', 'mmhg', '°c', '°f', 'w', 'kw', 'v', 'mah', 'zł', 'pln', 'eur', 'usd', 'gbp', '€', '$', '£',
  'px', 'dpi', 'rpm', 'bar', 'psi', 'ml', 'l',
].map((unit) => unit.replace(/[$/]/g, '\\$&')).join('|');

const edge = (body: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'giu');

/** Measured values with units, ranges and sources: the hard data that sets a page apart. */
export const EMPIRICAL_PATTERNS: RegExp[] = [
  new RegExp(`\\d+(?:[.,]\\d+)?\\s?(?:${UNITS})(?![\\p{L}\\p{N}])`, 'giu'),
  /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s?[-–—]\s?\d+(?:[.,]\d+)?(?![\p{L}\p{N}])/gu,
  edge('doi:|doi\\.org/|pmid:?\\s?\\d+|n\\s?=\\s?\\d+|p\\s?[<=]\\s?0[.,]\\d+|iso\\s?\\d{3,5}'),
  edge('randomi[sz]ed|randomizowan\\p{L}*|meta-?analy\\p{L}*|metaanaliz\\p{L}*|clinical trial|badani\\p{L}* klinicz\\p{L}*'),
];

/** First-hand experience markers by primary language; languages without a list report "unavailable". */
export const EXPERIENCE_MARKERS: Record<string, RegExp> = {
  en: edge('in our (?:tests?|testing|experience|practice|clinic|lab)|we (?:tested|measured|observed|compared|recorded)|our (?:patients|clients|customers) (?:reported|saw|found)|after \\d+ (?:days|weeks|months) of (?:use|using|testing)'),
  pl: edge('w naszych testach|podczas naszych testów|w naszej (?:praktyce|klinice|poradni|redakcji)|u naszych (?:pacjentów|klientów)|przetestowaliśmy|sprawdziliśmy|zaobserwowaliśmy|zmierzyliśmy|odnotowaliśmy|z naszego doświadczenia|przez \\d+ (?:dni|tygodni|miesięcy) (?:użytkowania|testowania|stosowania)'),
  de: edge('in unseren tests?|wir haben (?:getestet|gemessen|beobachtet|verglichen)|in unserer praxis|unsere patienten|nach \\d+ (?:tagen|wochen|monaten)'),
  es: edge('en nuestras pruebas|hemos (?:probado|medido|observado|comparado)|en nuestra (?:experiencia|práctica|clínica)|nuestros (?:pacientes|clientes)'),
  fr: edge('lors de nos tests|nous avons (?:testé|mesuré|observé|comparé)|dans notre (?:pratique|expérience|clinique)|nos (?:patients|clients)'),
  it: edge('nei nostri test|abbiamo (?:testato|misurato|osservato|confrontato)|nella nostra (?:pratica|esperienza|clinica)|i nostri (?:pazienti|clienti)'),
  pt: edge('nos nossos testes|(?:nós )?(?:testamos|testámos|medimos|observamos)|na nossa (?:prática|experiência|clínica)|(?:os )?nossos pacientes'),
  ru: edge('в наших тестах|мы (?:протестировали|измерили|заметили|сравнили|проверили)|в нашей практике|наши (?:пациенты|клиенты)'),
};

export const markersFor = (language: string): RegExp | undefined => EXPERIENCE_MARKERS[language.split(/[-_]/)[0].toLowerCase()];

export const countMatches = (text: string, patterns: RegExp[]): number =>
  patterns.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);

export const phrasesIn = (text: string, pattern: RegExp): string[] => [...new Set((text.match(pattern) ?? []).map((phrase) => phrase.toLowerCase()))];
