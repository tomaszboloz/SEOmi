PR naprawia błędy uruchamiania CLI/proxy, wyścig zatrzymywania workera oraz weryfikację zadań po crawlu. Dodaje zabezpieczenia przyszłych wydań i aktualizuje zależności frontend/MCP. Bieżący HEAD: `ec44974140a8f26ada613ec7fb0aae92d5b32397`; baza zawiera scalony #208.

Zmiany zachowania:
- CLI odczytuje stdin do EOF; regresje obejmują Unicode i metaznaki. Test przeciążenia proxy wymaga pełnej odpowiedzi HTTP503 z poprawnym Content-Length i obsługuje fragmentację.
- Zatrzymanie workera unieważnia równoległe odpytywania statusu. Opóźniony probe nie może nadpisać potwierdzonego stanu stopped. Zachowane rzeczywiste inactive/sessionExpired/leaseExpired i błędy stop.
- Weryfikacja zadania wymaga dostępnych dowodów z crawla rozpoczętego po znanym implementedAt. HTTP0, transport failure, HTTP500, brak ekstrakcji i niepełne body pozostawiają wynik nieznany. Prawdziwe HTTP410 i nowy link HTTP200 nadal potwierdzają wynik. Delty SPRS/EETV korzystają z rzeczywistych generatorów; brak wyniku pozostaje null.
- Release sprawdza komplet wymaganych kontroli dokładnego SHA i zgodność tagu. Platformy używają jednego draftu/releaseId; kompletność artefaktów, pary podpisów i fragmenty updatera są weryfikowane przed publikacją.
- Diagnostyka błędnego HTML w desktop E2E ma ograniczony rozmiar. Ścisła asercja Example Domain pozostaje zachowana; przyczyna wcześniejszej awarii macOS Intel pod LLVM nadal wymaga potwierdzenia.
- Cztery starsze fixture/contract testy dostosowano do nowego opcjonalnego startedAt. Historyczny fingerprint120kontraktów zachowano przez jawny rejestr additive i osobny test optionalstring/legacy.

Zależności: React19.3.1, Vite8.3.5, Vitest5.0.5, ESLint10.13.0, i18next26.5.10, react-i18next17.1.8. Frontend TypeScript6.0.3 spełnia peer range typescript-eslint8.72.0; latest TypeScript7.0.2 nadal jest z nim niezgodny. MCP używa TypeScript7.0.2, @types/node26.6.5, SDK1.32.2 i Zod4.6.7. Migracja pozostałego Rust/latest nie weszła do tego PR. Żądanie wszystkich paczek latest pozostaje otwarte.

Aktualne dowody CI dla tego HEAD: [run40181378997](https://github.com/tomaszboloz/SEOmi/actions/runs/40181378997).
- Frontend: **1352zestawy / 11057testów PASS**, lint/MAX150/version oraz typecheck i production bundle PASS; odczytano pełny log zakończonego jobu121132985248.
- Rust Backend Unit & Security Tests: PASS.
- Dependency Vulnerability Scan & SBOM: PASS.
- Windows: cały job PASS. Pobrany autentyczny artefakt desktop E2E przeszedł niezależny walidator: 25 kontroli bazowych, 199 IPC, 48 renderera; previewEvidence=ipc-success.
- macOS Intel: frontend i 2439 testów Rust PASS, build PASS, desktop E2E FAIL. Nowa diagnostyka pokazuje htmlLength=6086 i `<title>Rate Limited | example.com | Cloudflare</title>` przy finalURL=https://example.com/. To potwierdzona blokada zewnętrznego źródła bieżącego testu; Cloudflare HTML pozostaje FAIL.
- Run jest zakończony z failure. Zależne pomiary Rust 95% i frontend/MCP 98% mają SKIPPED po niespełnionym prerequisicie; nie są uznawane za PASS. Wymagana poprawa deterministyczności testowego originu przy zachowaniu ścisłych asercji i ochrony SSRF.

Odbiór lokalny obejmuje108powiązanych testów (wszystkie4wcześniejsze czerwone przypadki), niezależne reprodukcje stop/probe i dostępności dowodów,56regresji guardów wydania,17testówfrontend+2Rustexample+7niezależnych wykonań JS diagnostyki. Pełny lint, typecheck, MAX150, version i diff-check przeszły dla integrowanych źródeł.

Zakresy #138 (trwałe zdarzenia crawla), #144 (analiza obserwacyjna) i nowy artifact-bound provenance/SBOM #102 są nadal lokalnymi kandydatami. Audyt wykazał dalsze błędy, dlatego nie zostały dołączone do tego PR. Odpowiednie issues zawierają dowody i warunki odbioru.

Progi Rust95%, frontend/MCP98%, MAX150 oraz ochrona main pozostają bez zmian.100% całej aplikacji nie jest potwierdzone. Wersja0.4.40; brak merge do main i nowego wydania. Istniejący publiczny release422833695 i draft422833723 z unikalnymi artefaktami Windows pozostają zachowane.

Wykonawcy: wyłącznie Gemini High/effort high; najwyżej5Gemini+manager=6agentów. Manager audytuje i integruje.

Fixes #210. Fixes #211. Fixes #212. Refs #130, #102, #207, #152, #153, #176.
