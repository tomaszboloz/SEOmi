# AUDIT GAPS - SEOmi
Audytor: Staff Developer | Data: 2026-10-01

## Statystyki
- Zidentyfikowanych luk: 53
- Batchy do wdrożenia: 7
- Szacowany effort: 20–35 MD; estymacja orientacyjna, do korekty po pomiarze coverage.
- Baseline: commit 18fa446b13ec3f97db76896bfdf446f97fe80051; 704 frontend / 320 Rust / 27 MCP testów.
- Stan celu: NIEOSIĄGNIĘTY. >99% coverage i production-ready wymagają pomiarów i domknięcia poniższych bramek.

## Metoda i granice
Luki wynikają z przeglądu kodu i istniejącej infrastruktury; wpis wskazuje dowód, nie hipotetyczny exploit. Severity opisuje wpływ, a priorytet wyznacza batch. Architektoniczne rozmiary obejmują cały plik (także testy Rust). SQL injection/N+1 nie są przypisywane aplikacji bez warstwy SQL. CORS/CSRF lokalnego API oceniamy w kontekście loopback i Bearer, nie jak publiczny panel webowy. Raport nie jest certyfikatem OWASP. Nie podnosimy coverage przez wykluczanie kodu biznesowego ani dodawanie testów kopiujących implementację.

## Baseline pomiarów
Pomiary bazowego commitu (2026-10-01):
- Frontend: 704 testy; statements 76,30% (10011/13119), branches 62,05% (8241/13281), functions 72,94% (2791/3826), lines 79,10% (8281/10468). Vitest V8, include src/**/*.{ts,tsx}, exclude src/types/** (deklaracje).
- Rust: cargo llvm-cov 0.9.1; regions 67,69% (24193/35741), functions 64,33% (1499/2330), lines 67,64% (16342/24160). Brak danych branch coverage w tym pomiarze.
- Cel >99% nie został osiągnięty w żadnej z tych warstw.
 Wykluczenia muszą być jawne (deklaracje typów i zasoby nie są kodem wykonywalnym). Pełny suite po batchu oznacza frontend, Rust i MCP, dodatkowo build/formatowanie/static analysis.

## BATCH 1: Security Critical
- [x] GAP-001: [CRITICAL] Audyt HTTP nie waliduje odpowiedzi DNS ani nie przypina IP połączenia; DNS rebinding/SSRF. Dowód: `src-tauri/src/services/http_client.rs:63`. Status: FIXED (BATCH-1a); dowód: 12 deterministycznych testów http_client, pełny suite i Clippy. Resolver DI, przypięty transport per hop, jeden deadline i limit strumienia; brak testów zależnych od internetu.
- [x] GAP-002: [CRITICAL] Automatyczne przekierowania audytu HTTP nie walidują DNS każdego kolejnego hosta. Dowód: `src-tauri/src/services/http_client.rs:80`. Status: FIXED (BATCH-1a); dowód: 12 deterministycznych testów http_client, pełny suite i Clippy. Resolver DI, przypięty transport per hop, jeden deadline i limit strumienia; brak testów zależnych od internetu.
- [x] GAP-003: [HIGH] Limit 25 MB jest sprawdzany po response.bytes(), więc nie ogranicza alokacji odpowiedzi. Dowód: `src-tauri/src/services/http_client.rs:139`. Status: FIXED (BATCH-1a); dowód: 12 deterministycznych testów http_client, pełny suite i Clippy. Resolver DI, przypięty transport per hop, jeden deadline i limit strumienia; brak testów zależnych od internetu.
- [x] GAP-004: [HIGH] Klient audytu HTTP dziedziczy proxy środowiska i może ominąć politykę bezpośredniego połączenia. Dowód: `src-tauri/src/services/http_client.rs:76`. Status: FIXED (BATCH-1a); dowód: 12 deterministycznych testów http_client, pełny suite i Clippy. Resolver DI, przypięty transport per hop, jeden deadline i limit strumienia; brak testów zależnych od internetu.
- [x] GAP-005: [MEDIUM] Uprawnienia Tauri obejmują wildcard wszystkich lokalnych okien zamiast jawnej listy. Dowód: `src-tauri/capabilities/default.json:5`. Status: FIXED (BATCH-1b); testy limitów i kontraktów providerów/CLI oraz least privilege. Pełny suite, build i strict Clippy PASS.
- [x] GAP-006: [HIGH] Wyjście CLI zbierane przez wait_with_output nie ma limitu bajtów. Dowód: `src-tauri/src/commands/ai_cli.rs:619`. Status: FIXED (BATCH-1b); testy limitów i kontraktów providerów/CLI oraz least privilege. Pełny suite, build i strict Clippy PASS.
- [x] GAP-007: [MEDIUM] MCP provider response.json() nie ma limitu rozmiaru przed parsowaniem. Dowód: `mcp-server/src/index.ts:18`. Status: FIXED (BATCH-1b); testy limitów i kontraktów providerów/CLI oraz least privilege. Pełny suite, build i strict Clippy PASS.
- [x] GAP-008: [MEDIUM] Publiczny zapis AppConfig nie waliduje enumów, timeoutu, limitu przekierowań ani user-agenta. Dowód: `src-tauri/src/commands/settings.rs:330`. Status: FIXED (BATCH-1c); walidacja konfiguracji, ograniczony odczyt, atomowy zapis i testy błędów/recovery; pełny suite PASS.

## BATCH 2: Architecture & Design Patterns
- [ ] GAP-009: [HIGH] toolsStore łączy crawling, rankingi, AI, GSC, keyword research i backlinki w 2231 liniach. Dowód: `src/stores/toolsStore.ts`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-010: [HIGH] CrawlResultsTabs ma 5160 linii i łączy przetwarzanie danych z wieloma widokami. Dowód: `src/components/Domain/CrawlResultsTabs.tsx`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-011: [HIGH] SiteAudit ma 3176 linii: formularz, orkiestracja, artefakty i historia w jednym module. Dowód: `src/components/Domain/SiteAudit.tsx`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-012: [HIGH] site_crawler.rs ma 9998 linii z transportem, parsowaniem, checkpointami i konfiguracją. Dowód: `src-tauri/src/commands/site_crawler.rs`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-013: [MEDIUM] SemanticTopicalWorkspace 1814 linii miesza import, analizę i rendering. Dowód: `src/components/Charts/SemanticTopicalWorkspace.tsx`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-014: [MEDIUM] PageSpeedWorkspace 1152 linii miesza transport, persistence, oceny metryk i widok. Dowód: `src/components/Performance/PageSpeedWorkspace.tsx`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-015: [MEDIUM] html_parser.rs 3533 linii agreguje wiele niezależnych analiz HTML. Dowód: `src-tauri/src/services/html_parser.rs`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-016: [MEDIUM] seo_analyzer.rs 2047 linii agreguje scoring i wiele niezależnych reguł. Dowód: `src-tauri/src/services/seo_analyzer.rs`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-017: [MEDIUM] Monolityczny types/index.ts 1239 linii łączy kontrakty wszystkich domen. Dowód: `src/types/index.ts`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [x] GAP-018: [MEDIUM] MCP index.ts miesza rejestrację narzędzi i trzy transporty providerów. Dowód: `mcp-server/src/index.ts`. Status: FIXED (BATCH-1b); testy limitów i kontraktów providerów/CLI oraz least privilege. Pełny suite, build i strict Clippy PASS.
- [x] GAP-019: [MEDIUM] Natywny klient HTTP wiąże DNS, zegar, transport i limity bez kontraktu testowego. Dowód: `src-tauri/src/services/http_client.rs`. Status: FIXED (BATCH-1a); dowód: 12 deterministycznych testów http_client, pełny suite i Clippy. Resolver DI, przypięty transport per hop, jeden deadline i limit strumienia; brak testów zależnych od internetu.
- [ ] GAP-020: [MEDIUM] settingsStore dynamicznie importuje auditStore/authStore; auditStore importuje settingsStore. Dowód: `src/stores/settingsStore.ts:74`. Status: OPEN; wymagane testy red/green i rewalidacja.

## BATCH 3: Testing Infrastructure
- [ ] GAP-021: [HIGH] Brak mierzonej, wersjonowanej konfiguracji coverage dla całego frontendu. Dowód: `vite.config.ts`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-022: [HIGH] Brak bramki >99% statements/lines/branches/functions w CI. Dowód: `.github/workflows/test.yml`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-023: [HIGH] Brak natywnego raportu llvm-cov i bramki pokrycia Rust w CI. Dowód: `.github/workflows/test.yml`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-024: [HIGH] Testy MCP odkrywają schematy; brak happy/error testów wszystkich provider tools. Dowód: `mcp-server/test/server.test.mjs`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-025: [HIGH] Brak E2E uruchomionej aplikacji Tauri dla krytycznych przepływów. Dowód: `.github/workflows/test.yml`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-026: [MEDIUM] Brak zautomatyzowanej inwentaryzacji publicznych funkcji z dowodem testu. Dowód: `tests/`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [x] GAP-027: [MEDIUM] Brak testu DNS rebinding/redirect do sieci prywatnej dla inspect_url. Dowód: `src-tauri/src/services/http_client.rs:201`. Status: FIXED (BATCH-1a); dowód: 12 deterministycznych testów http_client, pełny suite i Clippy. Resolver DI, przypięty transport per hop, jeden deadline i limit strumienia; brak testów zależnych od internetu.
- [x] GAP-028: [MEDIUM] Brak testu strumieniowego przekroczenia limitu odpowiedzi audytu HTTP. Dowód: `src-tauri/src/services/http_client.rs:201`. Status: FIXED (BATCH-1a); dowód: 12 deterministycznych testów http_client, pełny suite i Clippy. Resolver DI, przypięty transport per hop, jeden deadline i limit strumienia; brak testów zależnych od internetu.

## BATCH 4: Performance & Resource Bounds
- [ ] GAP-029: [MEDIUM] readStorageEntries wylicza Object.keys(entries) w każdej iteracji: koszt kwadratowy. Dowód: `src/services/storage.ts:69`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-030: [HIGH] parseProjectBackup parsuje dowolnie duży string JSON bez limitu wejścia. Dowód: `src/services/projectBackup.ts:104`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [x] GAP-031: [MEDIUM] get_config czyta cały dowolnie duży plik przed deserializacją. Dowód: `src-tauri/src/commands/settings.rs:320`. Status: FIXED (BATCH-1c); walidacja konfiguracji, ograniczony odczyt, atomowy zapis i testy błędów/recovery; pełny suite PASS.
- [x] GAP-032: [MEDIUM] Regex identyfikatorów i nazw sekretów jest kompilowany przy każdym wywołaniu. Dowód: `src-tauri/src/commands/settings.rs:27`. Status: FIXED (BATCH-1c); walidacja konfiguracji, ograniczony odczyt, atomowy zapis i testy błędów/recovery; pełny suite PASS.
- [ ] GAP-033: [MEDIUM] Lokalne API nie ma jawnego limitu równoległych audytów/crawlów. Dowód: `mcp-server/src/localApi.ts:134`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-034: [MEDIUM] Lokalne API nie definiuje własnych timeoutów headers/request/keepalive. Dowód: `mcp-server/src/localApi.ts:134`. Status: OPEN; wymagane testy red/green i rewalidacja.

## BATCH 5: Error Handling & Logging
- [x] GAP-035: [MEDIUM] Uszkodzony JSON konfiguracji jest po cichu zastępowany defaults, bez informacji o utracie ustawień. Dowód: `src-tauri/src/commands/settings.rs:326`. Status: FIXED (BATCH-1c); walidacja konfiguracji, ograniczony odczyt, atomowy zapis i testy błędów/recovery; pełny suite PASS.
- [x] GAP-036: [MEDIUM] save_config nadpisuje plik bez atomowego zapisu; przerwanie grozi uszkodzonym JSON. Dowód: `src-tauri/src/commands/settings.rs:350`. Status: FIXED (BATCH-1c); walidacja konfiguracji, ograniczony odczyt, atomowy zapis i testy błędów/recovery; pełny suite PASS.
- [x] GAP-037: [MEDIUM] loadConfig tłumi każdy błąd odczytu i nie pokazuje statusu awarii konfiguracji. Dowód: `src/stores/settingsStore.ts:83`. Status: FIXED (BATCH-1c); walidacja konfiguracji, ograniczony odczyt, atomowy zapis i testy błędów/recovery; pełny suite PASS.
- [ ] GAP-038: [MEDIUM] Lokalne API przekazuje dowolne error.message runnera bez bezpiecznego mapowania. Dowód: `mcp-server/src/localApi.ts:128`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-039: [MEDIUM] Lokalne API nie nadaje identyfikatora korelacji żądaniu i odpowiedzi. Dowód: `mcp-server/src/localApi.ts`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-040: [MEDIUM] Brak wspólnego kontraktu strukturalnych logów JSON dla warstw IPC/MCP. Dowód: `src-tauri/src/lib.rs`. Status: OPEN; wymagane testy red/green i rewalidacja.

## BATCH 6: Code Quality & Validation
- [x] GAP-041: [MEDIUM] Domyślny user agent Rust chrome_desktop nie odpowiada frontendowemu chrome_mac. Dowód: `src-tauri/src/models/config.rs:34`. Status: FIXED (BATCH-1c); walidacja konfiguracji, ograniczony odczyt, atomowy zapis i testy błędów/recovery; pełny suite PASS.
- [ ] GAP-042: [MEDIUM] readJsonStorage<T> zwraca JSON as T bez walidacji runtime kontraktu. Dowód: `src/services/storage.ts:46`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-043: [MEDIUM] Local API konwertuje timeout/max_pages/max_depth Number(), przyjmując stringi/bool zamiast typów kontraktu. Dowód: `mcp-server/src/localApi.ts:94`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-044: [MEDIUM] Frontend i MCP duplikują reguły rynków, typy wyników i normalizację domen. Dowód: `src/services/dataforseo.ts; mcp-server/src/index.ts`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-045: [LOW] downloadText/downloadPdf duplikują cykl życia Blob URL i elementu anchor. Dowód: `src/services/export.ts:39`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-046: [MEDIUM] Kod biznesowy/widoki używają any zamiast zweryfikowanych danych providerów. Dowód: `src/components/Performance/PageSpeedWorkspace.tsx:102`. Status: OPEN; wymagane testy red/green i rewalidacja.

## BATCH 7: Documentation & DevOps
- [ ] GAP-047: [HIGH] Brak sekretów podpisujących: oficjalne instalatory i aktualizacje nie mogą przejść release gate. Dowód: `.github/workflows/release.yml`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-048: [MEDIUM] Release używa wycofanego runnera macos-13 dla Intel. Dowód: `.github/workflows/release.yml`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-049: [MEDIUM] CI nie uruchamia strict Clippy mimo natywnego kodu produkcyjnego. Dowód: `.github/workflows/test.yml`. Status: OPEN; wymagane testy red/green i rewalidacja.
- [ ] GAP-050: [MEDIUM] Brak lintera TypeScript/React w scripts i CI. Dowód: `package.json`. Status: OPEN; wymagane testy red/green i rewalidacja.

## [DISCOVERED] - Dynamiczne wykrycia
- [x] GAP-051: [DISCOVERED] [MEDIUM] googlePublicJson tłumiło błędny JSON i zwracało pusty obiekt jako sukces. Dowód przed poprawką: mcp-server/src/index.ts:60. FIXED (BATCH-1b): wymagany JSON object i test błędnego JSON/array/null.
- [x] GAP-052: [DISCOVERED] [MEDIUM] Komunikaty providerów były zwracane bez ograniczenia do bezpiecznego statusu (dowolne status_message/error.message). Dowód przed poprawką: mcp-server/src/index.ts:26,62. FIXED (BATCH-1b): komunikat lokalny + kod HTTP/zadania, test niewyciekania treści odpowiedzi.
- [ ] GAP-053: [DISCOVERED] [LOW] Wersja MCP runtime 1.0.0 różni się od package.json 0.0.1. Dowód: mcp-server/src/index.ts:25; mcp-server/package.json:3. OPEN; wymagany test kontraktu metadanych.


## Dziennik batchy
- BATCH-0: audyt bazowy: 50 wpisów; pomiary frontend/Rust ukończone, cel >99% pozostaje OPEN.
- BATCH-1a: transport HTTP. RED: nowe testy kontraktu nie kompilowały się przed dodaniem granicy resolvera. GREEN: 704 frontend / 330 Rust / 27 MCP; build frontend + MCP, rustfmt i strict Clippy. Test strumieniowego timeoutu ujawnił konkurujące deadline'y; naprawiono i ponowiono pełny Rust suite. Brak zmian IPC/migracji.

- BATCH-1b: limity wszystkich procesów AI CLI i JSON providerów MCP; wydzielony kontrakt providerów; wildcard capability usunięty. RED: test capability wykazał wildcard, testy nowych granic nie kompilowały/importowały się. GREEN: 705 frontend / 332 Rust / 33 MCP; build, rustfmt, strict Clippy PASS. GAP-051/052 odkryte i naprawione.
- BATCH-1c: konfiguracja: walidacja, 64 KiB limit, spawn_blocking, atomowe zastąpienie z cleanup, migracja chrome_desktop, widoczny stan błędów (12 języków), liniowe walidatory nazw sekretów zamiast regex per call. RED: 2 testy frontend failures oraz brak natywnych granic; GREEN: 708 frontend / 339 Rust / 33 MCP, build/rustfmt/Clippy PASS. Synchronizacja wygenerowanego schematu capabilities po BATCH-1b.
