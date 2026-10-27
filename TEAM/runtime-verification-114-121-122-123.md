# Dogłębna Weryfikacja Wymagań, Kodu i Środowiska Uruchomieniowego dla #114, #121, #122, #123

**Data analizy:** 2026-10-24  
**Baza odniesienia:** Gałąź `main` (SHA `189a244e`) oraz `integrate/all-open` (SHA `b36a10e9`)  
**Metodologia:** Analiza pełnej specyfikacji issue, inspekcja implementacji produkcyjnej, identyfikacja miejsc wywołania w runtime oraz pokrycia testami zachowania i asercjami brzegowymi.

---

## 1. Issue #114: Bezpieczny parser atrybutów HTML w MCP (meta & canonical)

### Pełne wymagania biznesowe i techniczne
1. **Apostrofy i cudzysłowy w meta-tagach:**
   - Poprzedni regex `content=["']([^"']*)["']` urywał wartość na pierwszym napotkanym apostrofie przy wartości otoczonej cudzysłowem podwójnym (np. `content="User's guide"` zwracało `"User"` lub `null`).
   - Wymagane: Pełne odczytywanie wartości atrybutu niezależnie od obecności apostrofów w `""`, cudzysłowów w `''` oraz wartości bez cudzysłowów.
2. **Kolejność atrybutów w znacznikach `<link rel="canonical">`:**
   - Poprzedni wzorzec `/<link[^>]+rel=…[^>]+href=…/` zakładał sztywną kolejność `rel` przed `href`. Frameworki SSR (Next.js, Nuxt) często renderują `href` przed `rel`.
   - Wymagane: Identyfikacja linku kanonicznego niezależnie od kolejności atrybutów oraz obsługa wieloczłonowych wartości tokenów `rel` (np. `rel="canonical alternate"`).
3. **Bramki:** Pliki ≤ 150 LOC, pokrycie MCP ≥ 98%.

### Rzeczywisty dowód w kodzie produkcyjnym (`main`)
* **Plik:** `mcp-server/src/htmlAttrs.ts` (39 LOC)
  ```typescript
  const ATTR_PATTERN = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  
  export const firstMeta = (html: string, name: string): string | null => {
    const wanted = name.toLowerCase();
    for (const attrs of tagAttrs(html, 'meta')) {
      const key = (attrs.get('name') ?? attrs.get('property') ?? '').toLowerCase();
      const content = attrs.get('content');
      if (key === wanted && content !== undefined && content !== '') return content;
    }
    return null;
  };
  
  export const canonicalHref = (html: string): string | null => {
    for (const attrs of tagAttrs(html, 'link')) {
      const rel = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
      const href = attrs.get('href');
      if (rel.includes('canonical') && href) return href;
    }
    return null;
  };
  ```
* **Miejsce wywołania w Runtime:** `mcp-server/src/auditRunner.ts` (linie 4, 30, 41-44):
  ```typescript
  import { canonicalHref, firstMeta } from './htmlAttrs.js';
  ...
  meta_description: meta('description'),
  canonical: canonicalHref(body),
  open_graph: Object.fromEntries(['og:title', 'og:description', ...].map((name) => [name, meta(name)])),
  ```

### Dowód w testach i CI
* **Plik testowy:** `mcp-server/test/htmlAttrs.test.mjs`
  - Asercja 1: `firstMeta('<meta name="description" content="User\'s guide">', 'description') === "User's guide"`.
  - Asercja 2: `firstMeta('<meta property=\'og:title\' content=\'Say "hi" &amp; go\'>', 'og:title') === 'Say "hi" & go'`.
  - Asercja 3: `canonicalHref('<link href="https://a.test/x" rel="canonical">') === 'https://a.test/x'`.
  - Asercja 4: `canonicalHref('<link rel="canonical alternate" href="https://a.test/y"/>') === 'https://a.test/y'`.
* **CI:** Sprawdzone w jobie `coverage-frontend-mcp` (status: PASS).

---

## 2. Issue #121: EETV Document Frequency dla YMYL

### Pełne wymagania biznesowe i techniczne
1. **Błąd deduplikacji korpusu:**
   - Wcześniejsza implementacja deduplikowała tablicę tytułów przed zliczaniem dopasowań leksykalnych. Serwis medyczny mający 10 artykułów o specyficznym temacie ze słowem „health” był redukowany do 1 trafienia, przez co nie przekraczał progu minimalnego (`TITLE_MIN_HITS = 3`).
2. **Kryteria akceptacji:**
   - Zliczanie wystąpień słownictwa YMYL w pełnym korpusie tytułów (Document Frequency).
   - Test: 10 artykułów z terminem „health” w tytule musi klasyfikować domenę jako YMYL `health`.
   - Plik ≤ 150 LOC, pokrycie ≥ 98%.

### Rzeczywisty dowód w kodzie produkcyjnym (`main`)
* **Plik:** `src/services/eeatTrust/ymyl.ts` (36 LOC)
  ```typescript
  const TITLE_MIN_HITS = 3;
  const TITLE_MIN_SHARE = 0.3;
  const TITLE_BUMP = 3;
  
  export const detectYmyl = (nodes: SchemaNode[], report: SiteFocusReport | undefined, titles: string[]): YmylCategory | undefined => {
    ...
    // Document frequency over every article title (repeated cores included): enough pages, enough share.
    const hits = titles.filter((title) => LEXICON[category].test(title)).length;
    const share = hits / Math.max(1, titles.length);
    bump(category, hits >= TITLE_MIN_HITS && share >= TITLE_MIN_SHARE ? TITLE_BUMP : share);
    ...
  };
  ```
* **Miejsce wywołania w Runtime:** `src/services/eeatTrust/build.ts:44` w głównym potoku ewaluacji E-E-A-T:
  ```typescript
  const ymyl = detectYmyl(allNodes, focus, titles);
  ```

### Dowód w testach i CI
* **Plik testowy:** `tests/eeatTrustEngine1.test.ts`
  - Asercja 1: `expect(detectYmyl([], undefined, Array.from({ length: 10 }, () => 'Health tips'))).toBe('health');` (DF = 10, udział = 100% -> YMYL włączony).
  - Asercja 2: `expect(detectYmyl([], undefined, ['health', 'health'])).toBeUndefined();` (2 strony to < progu minimalnego 3 -> brak fałszywego alarmu).
  - Asercja 3: `expect(detectYmyl([], undefined, [...Array.from({ length: 3 }, () => 'Health tips'), ...Array.from({ length: 17 }, (_, i) => `Cooking ${i}`)])).toBeUndefined();` (3/20 = 15% < progu 30%).

---

## 3. Issue #122: Uszczelnienie klasyfikacji kategorii SFS i filtr stron stopki

### Pełne wymagania biznesowe i techniczne
1. **Problem fałszywych kategorii:**
   - Strony stopki/pomocnicze (`/kariera`, `/regulamin`, `/kontakt`, `/reklama`, `/faq`) linkowane globalnie z szablonu otrzymywały wysoki inlink count przy niskiej głębokości (`depth <= 2`), przez co klasyfikator przypisywał im typ `category` z wagą 2.0x, drastycznie zaburzając obliczenia Site Focus Score.
2. **Kryteria akceptacji:**
   - Strona jest klasyfikowana jako kategoria TYLKO wtedy, gdy sama linkuje z treści głównej (`semantic_links`) do co najmniej 3 głębszych artykułów (`MIN_DOWNWARD_ARTICLES = 3`).
   - Rozszerzenie słownika stron technicznych w jednym wspólnym module (`utilityPages.ts`).
   - Strony stopki otrzymują wagę techniczną 0.1x lub artykułową 1.0x, nigdy 2.0x.

### Rzeczywisty dowód w kodzie produkcyjnym (`main`)
* **Pliki:**
  - `src/services/utilityPages.ts` (26 LOC): zunifikowany wzorzec `UTILITY_SEGMENT_PATTERN`.
  - `src/services/siteFocus/pageType.ts` (68 LOC):
    ```typescript
    export const MIN_DOWNWARD_ARTICLES = 3;
    
    export const classifyPage = (page: FocusPage, context: TypeContext): PageType => {
      ...
      if (segments.some((segment) => UTILITY_SEGMENT_PATTERN.test(normalizeSemanticText(segment))) || TECHNICAL_TITLE.test(title)) return 'technical';
      if ((context.graph.downward.get(url) ?? 0) < MIN_DOWNWARD_ARTICLES) return 'article';
      ...
    };
    ```
* **Miejsce wywołania w Runtime:** `src/services/siteFocus/evaluate.ts:31`:
  ```typescript
  const kind = classifyPage(page, context);
  const weight = TYPE_WEIGHT[kind]; // { homepage: 3, category: 2, article: 1, technical: 0.1 }
  ```

### Dowód w testach i CI
* **Plik testowy:** `tests/siteFocusUnits1.test.ts`
  - Asercja 1: Test sparametryzowany dla 16 slugów stopki (`kariera`, `regulamin-promocji`, `reklama`, `dla-mediow`, `faq`, `rodo`, `gdpr`, `cookies`, etc.) potwierdza klasyfikację jako `technical` nawet przy inlinks od wszystkich stron serwisu.
  - Asercja 2: Weryfikacja progu: `classifyPage(blog, withDownward(3)) === 'category'`, ale `classifyPage(blog, withDownward(2)) === 'article'`.

---

## 4. Issue #123: Złożenie diakrytyków i kanoniczny klucz semantyczny

### Pełne wymagania biznesowe i techniczne
1. **Problem niespójnego składania znaków:**
   - `semanticTermKey('Żółć', 'pl')` zachowywał polskie znaki diakrytyczne (`pl:żółć`), natomiast `tokens()` w audycie Topical Authority składał je do ASCII (`zolc`). Temat wpisany ręcznie bez ogonków nie dopasowywał się do stron oznaczonych językiem polskim.
2. **Kryteria akceptacji:**
   - Jeden kanoniczny klucz: `foldedKey` (do porównań leksykalnych i dopasowań) oraz `surface` (do prezentacji w UI).
   - Wprowadzony ręcznie temat bez znaków diakrytycznych dopasowuje się do terminów z ogonkami w językach `pl`, `de`, `es`.

### Rzeczywisty dowód w kodzie produkcyjnym (`main`)
* **Pliki:**
  - `src/services/semanticText.ts` (148 LOC): funkcje `semanticTermIdentity`, `normalizeSemanticText`, `uniqueSemanticTerms`.
  - `src/services/siteFocus/coreTopic.ts`: obsługa `manualKeys`.
  - `src/constants/semanticFoldFixtures.json`: współdzielone wektory testowe z silnikiem Rust.

### Dowód w testach i CI
* **Plik testowy:** `tests/semanticText.test.ts` (linie 113-138):
  - Asercja 1: `['pl', 'Żółć', 'zolc', 'żółć']` -> `semanticTermIdentity(typed, 'pl') === semanticTermIdentity(observed, 'pl')`.
  - Asercja 2: `['de', 'Größe', 'Groesse', 'größe']` i `['de', 'Müller', 'Mueller', 'müller']` -> identyczna tożsamość leksykalna.
  - Asercja 3: `['es', 'Cañón', 'canon', 'cañón']` -> dopasowanie.
  - Asercja 4: `termCoverage('Groesse', page)` dopasowuje się do terminu strony `'Größe'`.

---

## Podsumowanie i Werdykt Audytu
Wszystkie cztery zgłoszenia (#114, #121, #122, #123) posiadają **rzeczywistą, kompletną implementację w kodzie produkcyjnym**, są **aktywnie wywoływane w potokach runtime** i są **pokryte dedykowanymi testami zachowania**. Pozostawanie ich w stanie OPEN na GitHubie nie wynika z braków w kodzie, lecz z faktu, że commity integracyjne użyły frazy `Refs #...` zamiast `Fixes #...`, a proces governance nie dokonał ich formalnego odbioru.
