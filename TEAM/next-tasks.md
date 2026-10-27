# Plan Kolejnych Niezależnych Zadań (Po #130) dla Zespołu Gemini High

**Data opracowania:** 2026-10-24  
**Zasada przewodnia:** Zadania małe, ściśle izolowane, z weryfikacją na żywym runtime (nie deklarować 100% z lokalnych założeń), MAX 150 fizycznych linii na plik, Rust ≥95%, Frontend/MCP ≥98%. Brak danych = `unavailable` / `unknown`, bez retry/timeout bumps. Realizacja wyłącznie przez agentów Gemini High.

---

### Zadanie 1 (Priorytet Krytyczny): Bugfix weryfikacji Closed-Loop Task Tracker (#130)
- **Cel:** Wyeliminowanie fałszywych oznaczeń wdrożenia (`verified: index-ok`) przy błędach sieci i serwera oraz zapewnienie poprawności czasowej weryfikacji.
- **Konkretne pliki do modyfikacji:**
  - `src/services/optimizationTasks/verify.ts`
  - `tests/optimizationTasks.test.ts`
- **Wymagania:**
  1. Sprawdzenie `page.http_status === 200` dla zadania `remove-noindex`: kody 0 (błąd sieci), 4xx, 5xx muszą dawać wynik `failed` (`http-error` lub `wrong-status`).
  2. Dodanie sprawdzenia timestampu: weryfikacja uwzględnia tylko crawle, których czas startu jest późniejszy niż `task.implementedAt`.
  3. Obsługa delty dla SPRS i EETV (gdzie dostępne metryki bazowe).
- **Kryteria sukcesu:** Reprodukcja z `closedloop-noindex-auditor-reproduction.json` daje werdykt `failed`.

---

### Zadanie 2: Rzetelność Danych w Nowej Fali (#144, #143, #139)
- **Cel:** Usunięcie 3 blockerów wykazanych w audycie `/tmp/seomi-next-wave-review.json`.
- **Podzadania:**
  - **Zadanie 2A (#144 Causal Impact):** W `src/components/Charts/semanticTopical/signals/useCausalImpact.ts` oraz `src/services/causalMarket/impact.ts` – gdy Google Search Status zwraca `unavailable` lub `unknown`, wynik Causal Impact musi być jawnie `inconclusive` z flagą niepewności, zamiast raportować sukces/porażkę.
  - **Zadanie 2B (#143 Outreach Co-Pilot):** W `src/services/outreachCopilot/igos.ts` – powiązanie kandydata z konkretnym dowodem IGOS (`reportId`, `sourceUrl`, unikalne encje). Brak dowodu unikalnego Information Gain = brak szkicu wiadomości (stan pusty).
  - **Zadanie 2C (#139 Programmatic Template Governor):** W `src/components/Charts/semanticTopical/signals/templateAdapter.ts` – jawne przekazywanie stanu `unavailable` dla zmiennych szablonowych z crawlera oraz integracja tożsamości subtopiku TAS.

---

### Zadanie 3: Detekcja Szablonu Pustego Szkieletu SPA w Crawlerze (#131)
- **Cel:** Ochrona wskaźników SFS przed fałszywym zaniżeniem `word_count` na stronach Client-Side Rendering.
- **Konkretne pliki:**
  - `src-tauri/src/commands/site_crawler/models/focus_data.rs`
  - `src-tauri/src/commands/site_crawler/html_analysis.rs` (lub moduł parsowania DOM)
  - `src/types/crawl/page.ts`
- **Wymagania:**
  1. Detekcja obecności znaczników `__NEXT_DATA__`, `__NUXT__`, czy `window.__INITIAL_STATE__` przy niskiej zawartości tekstu z DOM.
  2. Ustawienie flagi `is_js_shell_suspected: true`.
  3. Testy na fixture HTML Next.js / Nuxt.js. Rust coverage ≥95%.

---

### Zadanie 4: Indexability & Canonical Gate dla SFS/TAS (#132)
- **Cel:** Obliczanie metryk Topical Authority i Site Focus wyłącznie na stronach rzeczywiście indeksowalnych.
- **Konkretne pliki:**
  - `src/services/siteFocus/evaluate.ts`
  - `src/services/topicalAuthority/`
- **Wymagania:**
  1. Wykluczenie z mianownika stron z `noindex`, kodami 4xx/5xx oraz zewnętrznym `canonical`.
  2. Raportowanie konfliktów w UI: licznik „pominięto N stron (noindex/canonical)”.
  3. Brak spadku SFS wywołanego stronami pomocniczymi lub zablokowanymi.

---

### Zadanie 5: Architektura SQLite Append-Only Event Log (#138 / #135)
- **Cel:** Zastąpienie in-memory `CrawlEventLog.events = []` trwałym append-only logiem SQLite w Tauri.
- **Konkretne pliki:**
  - `src-tauri/src/commands/storage/sqlite_events.rs`
  - `src/services/snapshots/eventLog.ts`
  - `src/services/crawlPersistence.ts`
- **Wymagania:**
  1. Tabela `crawl_events (seq INTEGER PRIMARY KEY, run_id TEXT, event_type TEXT, payload JSON, created_at TEXT)`.
  2. Transakcyjny zapis zdarzeń ze strumienia crawla.
  3. Odtwarzanie stanu widoków odczytowych (CQRS lite) po restarcie aplikacji.
