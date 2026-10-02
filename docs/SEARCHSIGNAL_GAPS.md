# Rozszerzenia SEOmi — SearchSignalSEO

Źródło porównania: SearchSignalSEO-vs-SEOmi.pdf, plan z 29.09.2026 względem SEOmi0.0.1. Rejestr dotyczy aktualnego kodu; nie zastępuje pierwotnego audytu72punktów. Każda funkcja wymaga testów, izolacji projektu i modułów <=150fizycznych linii. Status OPEN oznacza brak ukończonej implementacji.

| ID | Zakres | Stan i kryterium ukończenia |
|---|---|---|
| EXT-001 | GSC: kanibalizacja | LOCAL IMPLEMENTED (5i): joint query+page, pełna bieżąca analiza do25000wierszy, spójny zakres, trwałe snapshoty z cap250/flagą obcięcia, progi20wyświetleń/10%udziału, panel paginowany i sygnały do weryfikacji; testy loopback/analizy/zapisu/UI, bez liveGoogle ani automatycznego werdyktu |
| EXT-002 | GSC: spadki | EXISTING/PARTIAL: snapshoty i porównanie wspólnych wierszy już działają; uzupełnić równe okna i brakujące wiersze bez traktowania ich jako zera |
| EXT-003 | GSC: frazy tuż za TOP10 | LOCAL IMPLEMENTED (4q): osobny zakres pozycji >10..20 z progiem wyświetleń; istniejący zakres4..20 zachować jako szerszą szansę |
| EXT-004 | GSC: CTR odstający | LOCAL IMPLEMENTED (4q): benchmark ważony wyświetleniami z własnych fraz o podobnej pozycji; minimum próby, wykluczenie badanego wiersza, jawna niepewność |
| EXT-005 | GSC: AI Overviews | CONDITIONAL: odkrywanie rzeczywistych searchAppearance. Osobny raport tylko przy faktycznie udostępnionym wymiarze; obecnie Google podaje agregację w Web |
| EXT-006 | PageSpeed / CrUX | EXISTING/PARTIAL: rozdzielić pomiar laboratoryjny/terenowy, okno zbierania i brak próby; zweryfikować integracje na aktualnym kodzie |
| EXT-007 | Trending now | OPEN: trendy krajowe z rzeczywistym źródłem, krajem i czasem; darmowy feed/import, limitowany provider opcjonalny, bez fikcyjnego wolumenu |
| EXT-008 | Darmowy SERP | OPEN: adaptery/import rzeczywistych TOP10, źródło/czas/rynek/język; obsługa limitów i blokad, brak automatycznego przejścia na płatne API |
| EXT-009 | Embeddingi + SERP overlap | OPEN: zastąpić domyślne płatne klastrowanie lokalnymi embeddingami i wspólnymi URL; wersja/model/rynek, osobne progi, uzasadnienia par |
| EXT-010 | Audyt frazy docelowej | OPEN: fraza+konkretny URL, tytuł/H1/treść/intencja/linki, dowody z audytu, bez obietnic pozycji |
| EXT-011 | Luki treści TOP10 | OPEN: faktycznie pobrane strony TOP10, dostępność i daty, tematy/dowody/udział stron; brak danych nie oznacza luki |
| EXT-012 | Ollama | OPEN: modele lokalne/LAN, konfiguracja endpoint/model, test połączenia, generate/chat/embed, timeouts, walidacja odpowiedzi i jawne błędy |
| EXT-013 | Crawl w czasie | OPEN: porównanie dwóch ukończonych crawlów jednego projektu/zakresu; dodane/usunięte/zmienione strony i dowody |
| EXT-014 | Graf ważony GSC | OPEN: wewnętrzny PageRank + osobne rzeczywiste metryki GSC, rozróżnienie struktury od ruchu |
| EXT-015 | Darmowe odkrywanie fraz/intencja | OPEN: autocomplete/import, pochodzenie sugestii, dopasowanie fraz do stron i sygnały intencji z niepewnością |
| EXT-016 | Monitoring i powiadomienia | OPEN: lokalne alerty zmian, preferencje, deduplikacja, porównywalne okresy; email tylko po konfiguracji użytkownika |
| EXT-017 | Raport HTML i pomoc kontekstowa | OPEN: raport z dowodami i eksport HTML, pomoc przy progach/źródłach/ograniczeniach |

Wielu użytkowników, reset hasła i serwerowa kolejka działająca przy wyłączonym komputerze nie są częścią obecnej aplikacji desktopowej; wymagają osobnego produktu/backendu. Nie dodawać pozornych formularzy bez takiego zaplecza.

## Źródła Google zweryfikowane 02.10.2026

- https://developers.google.com/search/docs/appearance/ai-features — AI Overviews i AI Mode w ogólnych danych Web.
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query — query/page/date/country/device oraz dostępne searchAppearance odkrywane zapytaniem; API nie gwarantuje wszystkich wierszy.

## Podziękowania

@RafalSzy — poprawki i sugestia rozbudowy testów w PR#13. Nowe rozszerzenia wynikają z wymagań właściciela i dostarczonego porównania.
