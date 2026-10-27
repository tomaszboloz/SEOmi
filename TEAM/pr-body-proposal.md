# Propozycja Opisu PR (PR Body) do Włączenia Zmian Integracyjnych

> **Uwaga audytora:** Niniejszy opis stanowi propozycję dla PR gromadzącego zintegrowane zmiany fali Gemini High do gałęzi docelowej.

---

```markdown
## Podsumowanie Zmian w Fali Integracyjnej

Niniejszy PR integruje zweryfikowane prace zespołu wykonawczego Gemini High pod koordynacją i audytem technicznym Codexa.

### 1. Rozwiązane i Zweryfikowane Issues
- **Fix fixture testu retry crawlera:** Commit `b36a10e9` usuwa błąd `UnexpectedMessage` w `retry_tests_body.rs:28` (odczytanie pełnych nagłówków HTTP przed wysłaniem odpowiedzi i przerwaniem body). Przywraca zielony stan platform smoke na macOS i Windows.
- **Formalna parzystość zgłoszeń z `main`:**
  - #114: Zabezpieczenie parsera atrybutów HTML (`mcp-server/src/htmlAttrs.ts`).
  - #121: Zliczanie Document Frequency dla YMYL (`src/services/eeatTrust/ymyl.ts`).
  - #122: Uszczelnienie klasyfikacji kategorii SFS i filtr stron stopki (`src/services/siteFocus/pageType.ts`).
  - #123: Złożenie diakrytyków w kanoniczny `foldedKey` dla języków pl/de/es (`src/services/semanticText.ts`).

### 2. Status Poprawek Jakościowych (Zgłoszenia Reopened)
- **#130 (Closed-Loop Task Tracker):** Wykryto i zaadresowano lukę fałszywej weryfikacji usunięcia noindex przy błędach sieciowych HTTP 0 / 4xx / 5xx oraz dodano walidację świeżości crawla.
- **#138 (Spójność stanu / Event Log):** Udokumentowano konieczność przeniesienia in-memory event logu do SQLite; PR nie zamyka jeszcze trwałej persystencji.

### 3. Zgodność z Bramkami Projektu
- **Rust Coverage:** ≥ 95%
- **Frontend & MCP Coverage:** ≥ 98%
- **Limit wielkości plików:** Wszystkie nowe i zmienione pliki spełniają rygorystyczny limit MAX 150 fizycznych linii (`npm run check:loc`).
- **Rzetelność danych:** Brak danych oznacza jawny stan `unavailable` / `unknown`, bez sztucznych wyników i bez podnoszenia timeoutów.
- **Brak nowych wydań:** Ostatnim opublikowanym wydaniem pozostaje `v0.4.9`. Wydanie nowej wersji uzależnione jest od pełnego przejścia 10 wymaganych kontroli na zdalnym CI dla dokładnego commitu.
```
