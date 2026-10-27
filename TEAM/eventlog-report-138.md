# Raport Wdrożenia i Weryfikacji Issue #138 (EventLog & CQRS Lite w SQLite)

- **Wykonawca:** Agent Gemini High (`gemini-3.8-flash-high`, `--effort high`)
- **Konto:** `opowiesciodkrywcow@gmail.com`
- **Data wdrożenia:** 2026-10-24
- **Stan prac:** Lokalny diff w `/Users/tomaszboloz/.codex/worktrees/task-tracker/seomi` gotowy do audytu przez Managera (Codex). Brak commitów, pushy i mutacji GitHuba.

---

## 1. Zrealizowany zakres

### A. Silnik zdarzeń w natywnym SQLite (Rust)
- **Tabela `crawl_events` (Schema V3):** Dodano bezpieczną migrację V3 w `src-tauri/src/commands/run_store/schema.rs` tworzącą tabelę `crawl_events(project_id, run_id, seq, event_type, at, payload)` oraz indeks `idx_crawl_events_order`.
- **Monotoniczny zapis i rozróżnienie idempotencji od konfliktu (`events.rs`):** Transakcja `TransactionBehavior::Immediate`. Sprawdzenie `seq`:
  - Jeśli `seq <= current_max`: identyczny payload jest pomijany jako bezpieczny duplikat idempotentny; odmienny payload powoduje błąd `Sequence conflict at seq X: distinct data` i rollback transakcji.
  - Wykrywanie i odrzucanie luk (`Sequence gap`).
- **Kaskadowe czyszczenie i RODO/Erasure:**
  - `super::runs::delete_run` usuwa powiązane zdarzenia z `crawl_events`.
  - `super::erase::erase_project` usuwa zdarzenia projektu z `crawl_events`.
- **Komendy Tauri IPC:** Zarejestrowano `store_append_crawl_events` oraz `store_load_crawl_events` w `lib.rs` i `utils/logging/commands.rs`.
- **Refaktoryzacja limitu LOC w `lib.rs`:** Moduły testowe `compose_arg_*` przeniesiono do `src-tauri/src/compose_tests.rs` (80 LOC), redukując `lib.rs` do 144 LOC (zgodność z bramką MAX 150 LOC).

### B. Warstwa zdarzeniowa TypeScript (Frontend)
- **`PersistentCrawlEventLog` (`src/services/snapshots/persistentLog.ts`):** Obejście in-memory `CrawlEventLog` kolejką asynchroniczną z buforowaniem i przywracaniem oczekujących zdarzeń w przypadku błędu zapisu (`rollback`).
- **`sqliteEventSink.ts`:** Metody `persistCrawlEvents` i `fetchCrawlEvents` rzucające jawne błędy przy braku środowiska Tauri lub błędach IPC.
- **`replay.ts`:**
  - `buildSyntheticEventsFromRun(run, provenance)` obsługujące proweniencję `'checkpoint-derived'` (dla istniejących/migrowanych runów) oraz `'live-crawl'`.
  - `replayCrawlEvents` i `replayLatestRunEvents` odtwarzające stan z bazy SQLite z jawną obsługą błędów.
- **Integracja `crawlPersistence.ts`:**
  - `saveUnlocked`: zapisuje zdarzenia `live-crawl` do `crawl_events` i usuwa pusty blok `catch {}` — błędy bazy danych nie są ukrywane, lecz propagowane do wywołującego.
  - `loadCrawlRuns`: przy starcie odtwarza i weryfikuje dziennik zdarzeń najnowszego runu przez `replayCrawlEvents`.

---

## 2. Wyniki testów i weryfikacji

Wszystkie ciężkie polecenia uruchomiono pod blokadą `fcntl.flock /tmp/seomi-gemini-validation.lock`:

1. **Testy jednostkowe i integracyjne Rust:**
   - `cargo test commands::run_store`: **44 passed, 0 failed**.
     - Pokryte: `test_append_and_load_events_ordering`, `test_append_idempotence_and_conflict`, `test_append_sequence_gap_rejected`, `test_project_and_run_isolation`, `test_delete_run_cleans_events`, `test_erase_project_cleans_events`, mock IPC round-trip w `command_tests.rs`.
   - `cargo test compose_tests`: **8 passed, 0 failed**.
   - `cargo fmt -- --check`: **0 violations**.

2. **Testy TypeScript / Vitest:**
   - `npx vitest run tests/crawlEventLogSqlite.test.ts tests/crawlEventLogRestart.test.ts tests/crawlPersistence.test.ts tests/crawlStoreSqlite.test.ts tests/sprsWhatIfSnapshot.test.tsx tests/optimizationTasksCoverage.test.ts`: **6 passed, 35 passed, 0 failed**.
     - Testy pokrywają: brak środowiska Tauri, odrzucenie i rollback na błędzie I/O, izolację projektów i runów, migrację ze statusem `checkpoint-derived`, odporność otwartego What-If snapshotu na napływ 10 000 równoległych zdarzeń w tle, symulowany restart i odczyt przez IPC, odrzucanie konfliktów payloadu.

3. **Bramka MAX 150 LOC:**
   - `npm run check:loc`: `{"limit":150,"files":4241,"violations":[]}` (**0 violations**).

---

## 3. Pozostałe luki (Remaining Gaps)

- **Hook streamowania zdarzeń w locie (`src/stores/tools/crawl/execution.ts`):**
  - Plik `execution.ts` należy do agenta `closedloop`. Aby zachować izolację ownershipu i nie nadpisywać cudzych zmian, przygotowano dokładną specyfikację diffu w `TEAM/eventlog-execution-hook-contract.md`.
  - Przepływ persystencji po zakończeniu crawla oraz restart i replay działają w 100% w oparciu o trwałe zdarzenia w SQLite.
