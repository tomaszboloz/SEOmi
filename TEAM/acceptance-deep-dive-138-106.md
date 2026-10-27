# Bezkolizyjne Podzadania Wdrożeniowe: #138 (SQLite Append-Only) i #106 (Wspólne Warstwy Danych)

**Data opracowania:** 2026-10-24  
**Zasada integracyjna:** Bezkolizyjne, atomowe podzadania, zachowanie MAX 150 LOC na plik, pełne pokrycie testami, izolacja projektowa i brak regresji w istniejących funkcjach.

---

## 1. Issue #138: Spójność Stanu — SQLite Append-Only Log dla Crawla i What-If

### Pełne kryteria akceptacji (#138)
1. **Niemutowalność sesji What-If:** Symulator SPRS operuje wyłącznie na zamrożonym snapshocie (`freezeCopy`), brak współdzielonej mutowalnej referencji między symulacją a storem crawla (status: zaimplementowane w `src/services/snapshots/freeze.ts`).
2. **Append-Only Event Log w SQLite:**
   - Zdarzenia crawla zapisywane transakcyjnie jako sekwencyjny log zdarzeń (event sourcing / CQRS lite).
   - Log musi być trwale zapisywany w SQLite (Tauri / `rusqlite`), a nie wyłącznie w ulotnej tablicy pamięciowej JavaScript (`CrawlEventLog.events = []`).
3. **Odtwarzalność stanu po restarcie:**
   - Po ponownym uruchomieniu aplikacji widoki odczytowe (read projections) mogą być zrekonstruowane poprzez odtworzenie (fold/replay) logu zdarzeń z SQLite.
4. **Baner w UI:** Zakończenie nowego crawla w tle nie mutuje otwartej symulacji, lecz wyświetla baner informujący o dostępności nowszych danych.

### Mapa plików i istniejących testów dla #138
* **Pliki istniejące:**
  - `src/services/snapshots/eventLog.ts` (45 LOC) — in-memory log zdarzeń.
  - `src/services/snapshots/freeze.ts` (14 LOC) — deep freeze obiektów.
  - `src/services/crawlPersistence.ts` — obecna persystencja całych snapshotów JSON (`saveStoredRuns`).
  - `src/components/Charts/semanticTopical/signals/useGraphSnapshot.ts` — hook zarządzający snapshotem.
* **Istniejące testy:**
  - `tests/sprsWhatIfSnapshot.test.tsx` — test zachowania symulatora na snapshocie.
  - `tests/crawlEventLog.test.ts` (jeśli istnieje) lub testy projekcji event logu.

### Bezkolizyjne podzadania wdrożeniowe (Plan dla agentów)
1. **Podzadanie 138-A (Natywna tabela zdarzeń w Rust / SQLite):**
   - **Pliki:** `src-tauri/src/commands/storage/event_store.rs` (nowy, ≤150 LOC), `src-tauri/src/commands/storage/schema.rs`.
   - **Zakres:** Utworzenie tabeli `crawl_event_log`:
     ```sql
     CREATE TABLE IF NOT EXISTS crawl_event_log (
       seq INTEGER PRIMARY KEY AUTOINCREMENT,
       project_id TEXT NOT NULL,
       run_id TEXT NOT NULL,
       event_type TEXT NOT NULL,
       payload TEXT NOT NULL,
       created_at TEXT NOT NULL
     );
     CREATE INDEX IF NOT EXISTS idx_crawl_events_run ON crawl_event_log(project_id, run_id, seq);
     ```
   - **Komendy Tauri IPC:** `append_crawl_events(events)` (batch append) oraz `load_crawl_events(project_id, run_id, from_seq)`.
   - **Testy:** Nowy test jednostkowy Rust w `src-tauri/src/commands/storage/event_store/tests.rs` (transakcyjność, kolejność, izolacja współbieżna).
2. **Podzadanie 138-B (Adapter SQLite w TypeScript):**
   - **Pliki:** `src/services/snapshots/sqliteSink.ts` (nowy, ≤120 LOC).
   - **Zakres:** Implementacja `SqliteEventSink` subskrybującego zdarzenia z `CrawlEventLog.subscribe()`. Buforowanie i asynchroniczny zrzut przez `invoke('append_crawl_events')`.
   - **Testy:** `tests/sqliteEventSink.test.ts` z mockiem Tauri IPC.
3. **Podzadanie 138-C (Replay i integracja z persystencją):**
   - **Pliki:** `src/services/snapshots/replay.ts` (nowy, ≤110 LOC), `src/services/crawlPersistence.ts`.
   - **Zakres:** Funkcja `replayEventsFromStorage(projectId, runId)` odtwarzająca instancję `CrawlEventLog` z bazy danych SQLite, eliminując zależność od wielkich zrzutów JSON.
   - **Testy:** `tests/eventLogReplay.test.ts` sprawdzający identyczność stanu po odtworzeniu.

---

## 2. Issue #106: Audyt Duplikacji Modułów — Wspólne Warstwy Danych

### Pełne kryteria akceptacji (#106)
1. **Jedna wspólna warstwa `serpSnapshot`:**
   - Zunifikowany serwis zapytań i buforowania SERP (klucz: `keyword + geo + lang`).
   - Jawna atrybucja źródła (`dfs`, `bing_rss`, `free_suggest`, `manual_import`).
   - Konsumowany przez SFS (obecnie TOP10/3 zapytania), TAS (TOP3) oraz IGOS (#143).
2. **Wspólny `linkGraph` i jednolita definicja Orphan:**
   - Wyeliminowanie 3 rozbieżnych definicji strony osieroconej (obecnie w `topicalAuthority/silo.ts`, `semanticGraph/pageRank.ts` i audycie technicznym).
   - Uwzględnienie wag pozycji linku (main content vs nagłówek vs stopka).
3. **Centralny `metricHistory`:**
   - Jednolita rejestracja historii zmian metryk per projekt.
   - Wszystkie alerty generowane wyłącznie przez `monitoringAlerts/policy.ts` (brak podwójnych powiadomień).
4. **Wspólny silnik promptów AI (`aiBriefRunner`):**
   - Zastąpienie 5 niezależnych generatorów promptów jednym wykonawcą z obsługą cache semantycznego i token guardem.
5. **Jeden parser i generator JSON-LD:**
   - Ujednolicenie modułu `jsonLd.ts` (EETV) z generatorami schematów.
6. **Wspólny podział zdań (`sentenceSplitter`):**
   - Zastąpienie redundantnych implementacji podziału zdań wspólną funkcją w `semanticText.ts`.

### Mapa plików i istniejących testów dla #106
* **Pliki istniejące:**
  - `src/services/utilityPages.ts` — (już zunifikowane) wspólny słownik stron technicznych.
  - `src/services/siteFocus/pageType.ts` — zawiera funkcję `linkGraph`.
  - `src/services/topicalAuthority/silo.ts` — własna analiza grafu i orphanów.
  - `src/services/semanticGraph/pageRank.ts` — własny graf linków.
  - `src/services/citationEvidence/sentences.ts` — podział zdań dla cytowań.
  - `src/services/briefDocument/aeo.ts` — niezależna analiza zdań dla AEO.
  - `src/services/eeatTrust/jsonLd.ts` — parser JSON-LD.
  - `src/services/schemaGenerator/` — niezależny generator JSON-LD.
* **Istniejące testy:**
  - `tests/siteFocusUnits1.test.ts`
  - `tests/eeatTrustEngine1.test.ts`
  - `tests/semanticText.test.ts`
  - `tests/topicalAuthorityCore.test.ts`

### Bezkolizyjne podzadania wdrożeniowe (Plan dla agentów)
1. **Podzadanie 106-A (Sentence Splitter):**
   - **Pliki:** `src/services/semanticText/sentenceSplitter.ts` (nowy, ≤100 LOC), modyfikacja `src/services/semanticText.ts`.
   - **Zakres:** Wyodrębnienie zunifikowanej funkcji `splitSentences(text, language)` obsługującej skróty, liczby dziesiętne i wielojęzyczność (12 języków). Podpięcie pod AIO-R i EETV citations.
   - **Testy:** `tests/sentenceSplitter.test.ts`.
2. **Podzadanie 106-B (Wspólny LinkGraph & Definicja Orphan):**
   - **Pliki:** `src/services/sharedGraph/linkGraph.ts` (nowy, ≤130 LOC), modyfikacja `src/services/siteFocus/pageType.ts` oraz `src/services/topicalAuthority/silo.ts`.
   - **Zakres:** Centralizacja obliczania relacji inlinks/outlinks z uwzględnieniem `semantic_links`. Jedna kanoniczna funkcja `isOrphanPage(page, graph)` zwracająca spójny wynik dla wszystkich modułów.
   - **Testy:** `tests/sharedLinkGraph.test.ts`.
3. **Podzadanie 106-C (Ujednolicony SERP Snapshot):**
   - **Pliki:** `src/services/serpSnapshot/store.ts` (nowy, ≤140 LOC), `src/services/serpSnapshot/types.ts`.
   - **Zakres:** Jednolity cache z kluczem `keyword:geo:lang`, atrybucją źródła i datą pobrania. Integracja jako źródło dla SFS benchmarku i TAS.
   - **Testy:** `tests/serpSnapshotStore.test.ts`.
4. **Podzadanie 106-D (aiBriefRunner):**
   - **Pliki:** `src/services/aiBriefRunner/runner.ts` (nowy, ≤120 LOC), `src/services/aiBriefRunner/cache.ts`.
   - **Zakres:** Zunifikowany dispatch promptów AI z obsługą timeout/abort, semantycznym cache i walidacją długości.
   - **Testy:** `tests/aiBriefRunner.test.ts`.
