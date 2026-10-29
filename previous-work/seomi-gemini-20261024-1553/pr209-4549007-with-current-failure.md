Na HEAD `4549007c6513b280809ba735b79deb7e04da0486` PR łączy aktualizacje zależności z naprawami błędów fixture CLI/proxy, wyścigu stop/status workera (#212), weryfikacji zadań po crawlu (#130) oraz zabezpieczeniami wydawania (#102/#207). Baza zawiera scalony #208.

Frontend/MCP: React 19.3.1, Vite 8.3.5, Vitest 5.0.5, ESLint 10.13.0, i18next 26.5.10, react-i18next 17.1.8; frontend TypeScript 6.0.3 spełnia aktualny peer range typescript-eslint 8.72.0. MCP TypeScript 7.0.2, @types/node 26.6.5, SDK 1.32.2 i Zod 4.6.7. Migracja wszystkich pozostałych pakietów do latest, w tym Rust i frontend TypeScript 7, nadal wymaga dokończenia; ten PR nie jest dowodem realizacji całego tego celu.

Worker: kończenie start/stop unieważnia odpytywania uruchomione podczas operacji. Aktualna referencja lease zapobiega nadpisaniu potwierdzenia stopped przez sesję, która została już zakończona. Zachowane są rzeczywiste inactive/sessionExpired/leaseExpired i błędy stop. Dodano deterministyczną regresję: deferred stop i probe rozpoczęty podczas stop rozstrzygają się w tej samej partii aktualizacji React. Fixture zmienia backend status dopiero przy zatrzymaniu; nie używa stale-true, sleep, retry ani zmienionych timeoutów.

Task tracker: HTTP0, transport failure, HTTP500 z linkiem w treści błędu, brak ekstrakcji encji i niepełne body nie potwierdzają wdrożenia ani jego porażki. Zadanie pozostaje implemented przy niedostępnych dowodach. Prawdziwe HTTP410 i nowy link HTTP200 nadal potwierdzają wynik. Weryfikacja wymaga crawla rozpoczętego po znanej dacie implementedAt. Delty SPRS/EETV korzystają z rzeczywistych generatorów; brak wyniku pozostaje null. Niezakończony zakres #138 jest poza tą paczką.

Wydawanie: guardy sprawdzają komplet wymaganych kontroli CI dokładnego SHA oraz przypisanie tagu. Platformy używają jednego draftu/releaseId. Kompletność, pary podpisów i zgodność fragmentów updatera są weryfikowane przed publikacją. To źródłowe zabezpieczenie przyszłych wydań; nie konsoliduje ani nie publikuje istniejącego publicznego release 422833695 i draftu 422833723 z unikalnymi artefaktami Windows.

Fixture CLI odczytuje pełny stdin do EOF; regresja obejmuje Unicode i metaznaki. Fixture proxy po zajęciu 32 permitów wymaga pełnej odpowiedzi HTTP503 z poprawnym Content-Length; odrzuca ucięte body/nagłówki i obsługuje fragmentację. Produkcyjny limit i SSRF bez zmian.

Odbiór audytora na izolowanym release-next, Node22/macOS arm64:
- worker:18/18 testów, w tym niezależny oryginalny mounted/deferred reproduktor; typecheck, pełny lint, MAX150, version i diff-check PASS;
- task tracker/SPRS:112/112 testów pokrewnych +10/10 niezależnych przypadków dowodów; te same kontrole jakości PASS; zamrożony pomiar optimizationTasks/** i nowego wspólnego sprs/report.ts:100% statements/branches/functions/lines;
- guardy wydania:56/56 regresji, typecheck/lint/MAX150/version/diff PASS; źródła zachowały hashe podczas późniejszej integracji;
- wcześniejszy niezmieniony natywny zakres:55 testów proxy i62 CLI, fmt i clippy all-targets -Dwarnings PASS.

Świeży CI dla dokładnego HEAD: https://github.com/tomaszboloz/SEOmi/actions/runs/40179076946 — w toku. Wyniki wcześniejszych SHA nie zastępują tego runu. Nadal wymagane Windows/macOS Intel i pełne pomiary pokrycia. Znany odrębny bloker #176/#90 dotyczy renderer E2E pod LLVM-cov; trwa instrumentowane odtworzenie i doprecyzowanie diagnostyki.

Progi Rust95%, frontend/MCP98%, MAX150 i ochrona main pozostają bez zmian.100% całej aplikacji nie jest jeszcze potwierdzone. Wersja0.4.40; brak nowego wydania i brak merge do main. Wykonawcy: istniejące rozmowy Gemini High/high, obecnie potwierdzone opowiesciodkrywcow po rzeczywistym wyczerpaniu limitu wiedzamoto; maksymalnie6agentów łącznie z managerem.

Fixes #210. Fixes #211. Fixes #212. Refs #130, #102, #207, #152, #153, #176.


<!-- ci454-frontend-contract-blocker -->
Bieżący CI4549007: Rustbackend i zależności/SBOM PASS. Frontend job121126023786 FAIL:11040PASS/4FAIL w starszych fixture task freshness i pinach kontraktów po dodaniu opcjonalnego startedAt (#130). Poprawkę fixture oraz jawnych additive/legacy assertions wykonuje Gemini w odizolowanym ci-contract-fixtures. Nie cofamy produkcyjnego wymagania świeżych dowodów ani progów95/98/MAX150. Pełny log zachowany; platformy jeszcze w toku. Nadal bezmerge/main/release.
