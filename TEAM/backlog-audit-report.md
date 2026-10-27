# Raport Audytu Backlogu, Parzystości Gałęzi i Zadań Wykonawczych Gemini High

**Projekt:** SEOmi Desktop (`tomaszboloz/SEOmi`)  
**Data raportu:** 2026-10-24  
**Wykonawca:** Agent Gemini High (rola: `backlog`)  
**Konto wykonawcy:** `wiedzamoto@gmail.com`  
**Tryb pracy:** READONLY audyt źródeł, brak bezpośrednich edycji kodu produkcyjnego, ownership raportowy w `TEAM/`.

---

## 1. Stan Gałęzi, Zdalnego CI i Wydań

1. **Parzystość Gałęzi:**
   - `origin/main`: SHA `189a244efde28658430346e83a18d79a3f413997`
   - `origin/integrate/all-open`: SHA `b36a10e939157cb66929566d155db66fb3bbd58a` (PR #197 head, wersja `0.4.40`)
   - `codex/deps-latest`: SHA `8165d672078e2b23bf61ca8f0fae21379e1ecafc`
   - `codex/github-next`: SHA `2bf3a2061d77b74bb3de179465140e20dc8056d8` (lokalne prace nad #139, #143, #144)
   - `codex/coverage-100`: SHA `1ed2fd5f9688d4c9c4b7b08ec966b48340b3acae` (88/95 zachowanych plików pokrycia identycznych z integracją, 7 przejrzanych adaptacji – brak bulk copy).
2. **Stan CI i Naprawa Fixture:**
   - Poprzedni CI run `40098193473` (dla SHA `e5eade20`): Rust unit/security, frontend i dependency scan zakończone sukcesem (PASS), platform smoke na macOS i Windows upadły na teście `response_body_reads_honor_the_crawl_deadline` (`UnexpectedMessage` w `retry_tests_body.rs:28`), a coverage zostało pominięte (SKIPPED).
   - Wdrożono naprawę Gemini HTTP fixture patch w commicie `b36a10e9` (odczyt nagłówków HTTP przed wysłaniem odpowiedzi i przerwaniem strumienia).
   - Aktualny CI run `40104654800` jest w trakcie wykonywania (IN PROGRESS) na zdalnym GitHubie.
3. **Status Wydań i Wymagane Kontrole:**
   - Ostatnie rzeczywiste wydanie: `v0.4.9` (target commit `1ed2fd5f`, 11 zweryfikowanych artefaktów i podpisów).
   - Wersja robocza `0.4.40` NIE jest opublikowana.
   - Weryfikacja 10 wymaganych kontroli na `main`: 8 kontroli testowych/smoke/coverage + 2 analizery CodeQL. Skrypt `scripts/release-ci-gate.mjs` przeszedł 9 testów brzegowych zabezpieczających proces release przed przedwczesną publikacją.

---

## 2. Analiza Celowa Zgłoszeń: #114, #121, #122, #123, #138, #106, #90, #130

### Issue #114 (MCP: auditRunner ucina meta z apostrofem i nie widzi canonical)
- **Stan w kodzie:** Wdrożone w commicie `c4299409` (`mcp-server/src/htmlAttrs.ts`).
- **Weryfikacja testowa:** `mcp-server/test/htmlAttrs.test.mjs` testuje apostrofy w `""`, cudzysłowy w `''`, odwróconą kolejność atrybutów oraz rel z wieloma tokenami.
- **Obecność w gałęziach:** Commit znajduje się zarówno na `origin/main`, jak i na `origin/integrate/all-open`.
- **Wniosek:** Kod jest gotowy i kompletny. Issue pozostaje otwarty wyłącznie ze względów administracyjnych na GitHubie (`Refs` zamiast `Fixes`).

### Issue #121 (EETV: detectYmyl deduplikuje wejście przed zliczeniem trafień)
- **Stan w kodzie:** Wdrożone w commicie `400b63fc` (`src/services/eeatTrust/ymyl.ts`).
- **Weryfikacja testowa:** `tests/eeatTrustEngine1.test.ts` weryfikuje Document Frequency dla korpusu 10 powtórzonych artykułów ze słownictwem medycznym.
- **Obecność w gałęziach:** Commit znajduje się na `origin/main` i `origin/integrate/all-open`.
- **Wniosek:** Kod kompletny. Wymaga formalnego zamknięcia na GitHubie.

### Issue #122 (SFS: pageType klasyfikuje strony stopki jako category)
- **Stan w kodzie:** Wdrożone w commicie `379602bc` (`src/services/siteFocus/pageType.ts`, `src/services/utilityPages.ts`).
- **Weryfikacja testowa:** `tests/siteFocusUnits1.test.ts` potwierdza, że strony stopki otrzymują wagę 0.1 lub 1.0 i nie awansują do kategorii (waga 2.0) bez posiadania ≥3 linków do głębszych podstron (`MIN_DOWNWARD_ARTICLES = 3`).
- **Obecność w gałęziach:** Commit na `origin/main` i `origin/integrate/all-open`.
- **Wniosek:** Kod kompletny na `main`. Wymaga zamknięcia na GitHubie.

### Issue #123 (Niespójne składanie diakrytyków)
- **Stan w kodzie:** Wdrożone w commitach `2ac81360` i `68824731` (`src/services/semanticText.ts`, `src/services/topicalAudit/evidence.ts`).
- **Weryfikacja testowa:** `tests/semanticText.test.ts` weryfikuje dopasowanie tematów bez ogonków do tekstów ze znakami diakrytycznymi (pl/de/es).
- **Obecność w gałęziach:** Commity na `origin/main` i `origin/integrate/all-open`.
- **Wniosek:** Kod kompletny na `main`. Wymaga zamknięcia na GitHubie.

### Issue #138 (Spójność stanu / CQRS lite)
- **Stan w kodzie:** Niemutowalne snapshoty (`freezeCopy`) i baner UI zostały wdrożone w `src/services/snapshots/`.
- **Pozostała luka:** `CrawlEventLog.events` jest zwykłą prywatną tablicą in-memory (`private events: CrawlEvent[] = []`). Brak powiązania z append-only logiem SQLite w Tauri. Brak trwałej persystencji po restarcie.
- **Status:** **REOPENED**.

### Issue #106 (Wspólne warstwy danych przed IGOS/SIJA/SPRS)
- **Stan w kodzie:** Częściowa unifikacja (słownik stron technicznych w `utilityPages.ts`).
- **Pozostała luka:** 5 osobnych generatorów promptów AI (brak `aiBriefRunner`), redundantne obliczanie grafu linków w 3 modułach, brak współdzielonego serwisu `serpSnapshot` z cache'em między SFS a TAS.
- **Status:** Otwarty dług architektoniczny (tech-debt).

### Issue #90 (Odbiór i kryteria akceptacji 7 modułów)
- **Zasada nadrzędna:** Brak danych = `unknown` / `unavailable` / `inconclusive`. Zakaz generowania sztucznych wyników lub maskowania błędów sieciowych.
- **Wykryte odchylenia w nowej fali:** Zidentyfikowano 3 blockery w implementacjach nowej fali (#139, #143, #144), gdzie brak danych ze źródeł zewnętrznych traktowano jako potwierdzony brak zjawiska.

### Issue #130 (Closed-Loop Task Tracker)
- **Status:** **REOPENED**.
- **Wykryty błąd runtime:** Reprodukcja z `closedloop-noindex-auditor-reproduction.json` wykazała, że funkcja `noindex(page)` w `src/services/optimizationTasks/verify.ts` zwracała `ok: true, code: 'index-ok'` dla stron z błędem sieci HTTP 0 oraz błędami HTTP 404/500, ponieważ brak ciągu "noindex" w pustej odpowiedzi był interpretowany jako poprawna indeksowalność. Ponadto brakowało sprawdzenia timestampu crawla względem `task.implementedAt`.

---

## 3. Rekomendacja Kolejnych Działań dla Zespołu

1. Skupienie kolejnego agenta Gemini High na poprawce runtime weryfikatora #130 (`verify.ts` i `runVerification.ts`).
2. Usunięcie trzech blockerów rzetelności danych w #144, #143, #139 zgodnie z raportem `/tmp/seomi-next-wave-review.json`.
3. Stopniowe adresowanie zadań po #130: detekcja pustego szkieletu SPA w crawlerze (#131) oraz Indexability Gate (#132).
4. Przekazanie propozycji komentarzy i PR body do managera (Codex) bez publikacji na GitHubie.
