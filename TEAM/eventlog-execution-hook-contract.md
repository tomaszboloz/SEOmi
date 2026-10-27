# Kontrakt Hooka Live EventLog w `execution.ts` dla Managera / Closedloop

- **Dotyczy:** Issue #138 (CQRS lite & EventLog streaming w locie)
- **Status:** Uzgodniony kontrakt techniczny dla właściciela `execution.ts` (`closedloop`)
- **Autor komponentu bazowego:** Gemini High (`wiedzamoto@gmail.com`)

---

## 1. Architektura i Inwarianty

1. **Monotoniczna numeracja sekwencji (`seq`):**
   - `seq: 1` -> `crawl:started` z payloadem `{ id: runId, startUrl, startedAt, config, provenance: 'live-crawl' }`
   - `seq: 2 .. N+1` -> `crawl:page` z danymi strony `{ url, http_status, response_time_ms, ..., provenance: 'live-crawl' }`
   - `seq: N+2` -> `crawl:completed` z payloadem `{ id: runId, completedAt, pageCount: N, startUrl, provenance: 'live-crawl' }`
   - Baza SQLite w Rust egzekwuje `seq == current_max + 1`. Luki są odrzucane. Dokładne duplikaty (`seq <= current_max` z identycznym payloadem) są bezpiecznie pomijane bez błędu. Odmienne dane przy tym samym `seq` powodują błąd `Sequence conflict` i atomowy rollback transakcji.

2. **Znaczniki czasu (`at`) i proweniencja (`provenance`):**
   - W strumieniu na żywo (`execution.ts`): zdarzenia mają `provenance: 'live-crawl'`, `startedAt` odpowiada faktycznemu rozpoczęciu crawla.
   - W syntetycznych migracjach / snapshotach: `provenance: 'checkpoint-derived'`, `startedAt = run.startedAt ?? run.completedAt`.

3. **Brak konfliktu przy terminalnym zapisie (`terminal save`) i restarcie:**
   - Przy zapisie snapshotu (`saveUnlocked` w `crawlPersistence.ts`): system sprawdza `fetchCrawlEvents(projectId, latest.id)`. Jeśli zdarzenia dla danego `runId` zostały już zapisane na bieżąco przez `liveEventLog` z proweniencją `live-crawl`, `saveUnlocked` **nie re-aplikuje** syntetycznych zdarzeń `checkpoint-derived`, co całkowicie eliminuje konflikt sekwencji / payloadu.
   - Przy restarcie (`loadCrawlRuns` i `replayLatestRunEvents`): jeśli snapshot w `crawl_runs` nie został jeszcze ukończony (np. przerwanie procesu w trakcie), `loadCrawlRuns` automatycznie odnajduje run w tabeli `crawl_events`, odtwarza zebrane strony i rekonstruuje obiekt `CrawlRunRecord`.

---

## 2. Proponowany minimalny diff w `src/stores/tools/crawl/execution.ts`

Plik `src/stores/tools/crawl/execution.ts` należy do agenta `closedloop`. Poniższy diff demonstruje bezkolizyjne podpięcie instancji `PersistentCrawlEventLog`:

```typescript
import { PersistentCrawlEventLog } from '@/services/snapshots';

// Wewnątrz startSiteCrawl po wyznaczeniu runId:
const liveEventLog = projectIdAtStart
  ? new PersistentCrawlEventLog(projectIdAtStart, runId)
  : null;

// Rejestracja startu:
liveEventLog?.append('crawl:started', {
  id: runId,
  startUrl: targetUrl,
  startedAt: interruptedCrawl.startedAt,
  config: persistedCrawlConfig,
  provenance: 'live-crawl',
});

// W callbacku nasłuchującym postęp (lub po pobraniu stron):
// Dla każdej pobranej strony:
liveEventLog?.append('crawl:page', {
  ...pageSummary,
  provenance: 'live-crawl',
});

// Po pomyślnym zakończeniu:
liveEventLog?.append('crawl:completed', {
  id: runId,
  completedAt: new Date().toISOString(),
  pageCount: freshCrawlResult.pages.length,
  startUrl: targetUrl,
  provenance: 'live-crawl',
});
await liveEventLog?.flush();
```

---

## 3. Gwarancje Odporności i Kolejkowania

- **Odporność na błędy I/O i brak trwałego zatrucia kolejki:**
  - `PersistentCrawlEventLog` przy błędzie zapisu (`flush`) zachowuje niezapisane zdarzenia na początku kolejki `pending`.
  - Kolejne wywołanie `append` lub `flush` ponawia próbę zapisu bez blokowania kolejki (`queuePermanentlyRejected: false`).
- **Paginacja >10 000 zdarzeń:**
  - `fetchAllCrawlEvents` iteruje po paczkach do 10 000 zdarzeń z zachowaniem ciągłości sekwencji (`seq`), eliminując ciche ucinanie zdarzeń.
- **Środowisko WebView / przeglądarka:**
  - W przeglądarce bez Tauri `isTauriEnvironment() === false`, persistencja zdarzeń rzuca jawny błąd i nie symuluje fałszywego sukcesu SQLite.

---

## 4. Koordynacja z Native Collector (Decyzja Managera v2)

Zgodnie z decyzją managera (`manager-eventlog-contract-v2.md`) i kontraktem `backlog.native-collector.contract.json`:
1. **Pojedynczy autor sekwencji:** Natywny kolektor `NativeCrawlCollector` w `site_crawler/orchestration` zapisuje zdarzenia `crawl:started` (seq 1), `crawl:page` (seq 2..N) w czasie rzeczywistym podczas pobierania i asamblacji stron, oraz `crawl:completed` (seq N+1) bez opóźniania do zwrotu polecenia IPC.
2. **Brak duplikacji po stronie JS:** Frontendowy hook `LiveCrawlEventHook` nie tworzy równoległego strumienia zapisu do tabeli `crawl_events`.
3. **UI i metryki:** Postęp pobierania dostarczany jest do frontendu zdarzeniem Tauri `"crawl-progress"` bez konfliktów zapisu w SQLite.

