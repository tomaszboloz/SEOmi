Aktualizuje narzędzia frontendu i MCP do najnowszych kompatybilnych wersji oraz stabilizuje natywne testy CLI i limitu połączeń proxy. HEAD: `d643e0237fa66cfa3d328be0e1bcf787f44d716d`; baza zawiera scalony #208.

Frontend: React 19.3.1, Vite 8.3.5, Vitest 5.0.5, ESLint 10.13.0, i18next 26.5.10 i react-i18next 17.1.8. TypeScript 6.0.3 zachowuje zgodność z peer range typescript-eslint 8.72.0 (<6.1). MCP: TypeScript 7.0.2, @types/node 26.6.5, SDK 1.32.2 i Zod 4.6.7; pomiar pokrycia używa rzeczywistego lokalnego kompilatora. Lockfile i regresje dla locale/store/DOM oraz dostępnej nazwy selektora języka są uwzględnione.

Fixture CLI odczytuje stdin do EOF przed zakończeniem procesu na Unix/Windows; regresja porównuje pełny prompt z Unicode i metaznakami shell. Fixture proxy po zajęciu 32 permitów wykonuje jeden read-only probe i wymaga rzeczywistej odpowiedzi 503, Content-Length: 30 i kompletnego body. Odczyt kończy po odebraniu całej odpowiedzi; niepełne body, niepełne nagłówki, brak/błędne Content-Length i pusty EOF powodują błąd. Dodano przypadek poprawnej odpowiedzi przesyłanej fragmentami. Eliminuje to oczekiwanie na EOF po kompletnym 503 oraz wyścig oparty na powtarzaniu żądań. Produkcyjny proxy, limit 32, SSRF i runner CLI pozostają bez zmian.

Walidacja audytora na dokładnych źródłach nowego commita, macOS arm64:
- 55 testów proxy i 62 CLI PASS;
- cargo fmt, clippy --all-targets -Dwarnings, MAX150 i git diff --check PASS;
- dodatkowy prawdziwy TCP test odrzuca ucięte body i brak długości, a przyjmuje kompletny 503;
- hashe czterech integrowanych plików oraz Cargo.toml/lock były stabilne podczas kontroli.

Wcześniejsze kontrole niezmienionych źródeł frontendu/MCP: czyste npm ci na Node 22, typecheck, pełny lint, zgodność wersji i build;54 regresje UI PASS;192 testy MCP i 100% czterech metryk. Zamrożony pełny frontend:11009 testów / 1346 zestawów,99.94% statements / 99.81% branches / 99.91% functions / 99.99% lines. To nie stanowi dowodu 100% całej aplikacji.

Wymagane jest świeże CI dla HEAD d643e02, w tym Windows/macOS Intel i pomiary pokrycia. Poprzedni run 40121558461 na innym SHA nie jest dowodem dla tej poprawki. Bramki Rust95%, frontend/MCP98% i MAX150 pozostają bez zmian. Wersja aplikacji nadal 0.4.40; brak nowego wydania lub scalenia do main.

Poza tym PR pozostają migracja Rust/latest, bramka wydawania #102/#207 i funkcje #130/#138/#139/#143/#144. Ich lokalne raporty nie oznaczają integracji.

Fixes #210. Fixes #211. Refs #152, #153, #176.


<!-- current-ci-blocker-212 -->
Aktualny wynik run40129531377 dla dokładnego d643e02: Windows, frontend, Rustunit/security i zależności/SBOM PASS. macOS Intel FAIL w `tests/renderWorkerPanelBranches.test.tsx:72`: expected stopped, actual sessionExpired; 10962 testy PASS / 1 FAIL. Ta awaria UI zatrzymała job przed natywnym potwierdzeniem proxy. Coverage followups SKIPPED po nieudanym prerequisicie. Konkretny bloker #212 jest przypisany frontendowi; nadal wymagane nowe poprawione źródła i pełne exact-SHA CI przed merge. Osobny #176/#90 wymaga naprawy rzeczywistego renderer E2E i ukończonego pomiaru95. Bramki bez zmian; brak merge/main lub nowego release.
