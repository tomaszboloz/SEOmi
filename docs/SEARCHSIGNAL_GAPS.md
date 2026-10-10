# Rozszerzenia SEOmi — SearchSignalSEO

Źródło porównania: SearchSignalSEO-vs-SEOmi.pdf, plan z 29.09.2026 względem SEOmi0.0.1. Rejestr dotyczy aktualnego kodu; nie zastępuje pierwotnego audytu72punktów. Każda funkcja wymaga testów, izolacji projektu i modułów <=150fizycznych linii. Status OPEN oznacza brak ukończonej implementacji.

| ID | Zakres | Stan i kryterium ukończenia |
|---|---|---|
| EXT-001 | GSC: kanibalizacja | LOCAL IMPLEMENTED (5i): joint query+page, pełna bieżąca analiza do25000wierszy, spójny zakres, trwałe snapshoty z cap250/flagą obcięcia, progi20wyświetleń/10%udziału, panel paginowany i sygnały do weryfikacji; testy loopback/analizy/zapisu/UI, bez liveGoogle ani automatycznego werdyktu |
| EXT-002 | GSC: spadki | LOCAL IMPLEMENTED (5j): porównywane wyłącznie poprawne, rozłączne okresy o tej samej liczbie dni UTC; wspólne wiersze mają rzeczywiste delty, jednostronne obserwacje osobne listy i ostrzeżenie (brak≠zero); bez liveGoogle ani rozstrzygania sezonowości |
| EXT-003 | GSC: frazy tuż za TOP10 | LOCAL IMPLEMENTED (4q): osobny zakres pozycji >10..20 z progiem wyświetleń; istniejący zakres4..20 zachować jako szerszą szansę |
| EXT-004 | GSC: CTR odstający | LOCAL IMPLEMENTED (4q): benchmark ważony wyświetleniami z własnych fraz o podobnej pozycji; minimum próby, wykluczenie badanego wiersza, jawna niepewność |
| EXT-005 | GSC: AI Overviews | CONDITIONAL: odkrywanie rzeczywistych searchAppearance. Osobny raport tylko przy faktycznie udostępnionym wymiarze; obecnie Google podaje agregację w Web |
| EXT-006 | PageSpeed / CrUX | EXISTING/PARTIAL: rozdzielić pomiar laboratoryjny/terenowy, okno zbierania i brak próby; zweryfikować integracje na aktualnym kodzie |
| EXT-007 | Trending now | LOCAL IMPLEMENTED: krajowy Google Trends RSS przez limitowany native adapter i import; kraj/czas/źródło, izolacja projektu, bez fikcyjnego wolumenu; testy parsera/transportu/UI i live odczyt feedu, pełny live desktop transport jeszcze niepotwierdzony |
| EXT-008 | Darmowy SERP | LOCAL IMPLEMENTED/PARTIAL: import rzeczywistych SERP JSON/CSV z rynkiem/pochodzeniem/czasem; darmowy Bing RSS przez native adapter zawsze partial, bez utożsamiania z Google TOP10 ani płatnego fallback; testy transportu/ownership/UI |
| EXT-009 | Embeddingi + SERP overlap | LOCAL IMPLEMENTED: embeddingi + overlap dla kwalifikowanych kompletnych zgodnych SERP, uzasadnienia par, walidacja rynku/źródła, odporne centroidy; partial Bing używa semantic-only; testy usług i UI, live modele pozostają niezweryfikowane |
| EXT-010 | Audyt frazy docelowej | LOCAL IMPLEMENTED: konkretny URL/fraza, title/H1/body/anchors i znana intencja, evidence/time/status; izolacja projektów i request ownership, testy UI/usług; bez obietnic pozycji |
| EXT-011 | Luki treści TOP10 | LOCAL IMPLEMENTED/PARTIAL: luki na faktycznie pobranych URL z importowanego SERP, tematy/udział/daty/status i unknown dla brakujących stron; Bing partial nie dowodzi kompletnego Google TOP10; testy usług/UI |
| EXT-012 | Ollama | LOCAL IMPLEMENTED/PARTIAL: loopback Ollama embeddings/generate/chat/discovery i panel asystenta, model/instrukcje/limity/persistencja projektowa, race/error/direct tests; live model i desktop LAN nadal niezweryfikowane |
| EXT-013 | Crawl w czasie | LOCAL IMPLEMENTED: guardy projektu/zakresu/konfiguracji/dat i kompletności we wszystkich widokach; added/removed/changed z dowodami, blokada kolizji kluczy URL/ścieżek; bezpośrednie testy usług i UI, pełny pomiar po integracji pozostaje wymagany |
| EXT-014 | Graf ważony GSC | LOCAL IMPLEMENTED: strukturalny PageRank oddzielony od rzeczywistych danych GSC; guardy zakresu, unknown dla braków, odrębne missing/uncertain i jawne limity grafu/wierszy; direct service/UI tests, bez liveGoogle |
| EXT-015 | Darmowe odkrywanie fraz/intencja | LOCAL IMPLEMENTED: autocomplete/import z provenance i nieznanymi metrykami; dopasowanie do obserwowanych stron własnego projektu/języka; heurystyczne sygnały intencji oznaczone uncertain, zapis nadal Unknown; direct service/UI tests, bez potwierdzenia intencji przez SERP |
| EXT-016 | Monitoring i powiadomienia | LOCAL IMPLEMENTED: jawny opt-in, porównywalne zakresy/okresy, progi i trwała historia; projektowa deduplikacja/frequency guard z cache na awarię zapisu; wynik transportu oddzielony od persystencji; email wyłącznie przez skonfigurowany adapter, bez live dostarczenia |
| EXT-017 | Raport HTML i pomoc kontekstowa | LOCAL IMPLEMENTED/PARTIAL: zlokalizowany HTML audytu/crawla, jawne ograniczenia/provenance/szablony, ContextHelp i dostępna stale relacja opisu fieldsetu; direct export/help tests; szeroka pomoc kontekstowa nadal wymaga przeglądu |

Wielu użytkowników, reset hasła i serwerowa kolejka działająca przy wyłączonym komputerze nie są częścią obecnej aplikacji desktopowej; wymagają osobnego produktu/backendu. Nie dodawać pozornych formularzy bez takiego zaplecza.

## Źródła Google zweryfikowane 02.10.2026

- https://developers.google.com/search/docs/appearance/ai-features — AI Overviews i AI Mode w ogólnych danych Web.
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query — query/page/date/country/device oraz dostępne searchAppearance odkrywane zapytaniem; API nie gwarantuje wszystkich wierszy.

## Podziękowania

@RafalSzy — poprawki i sugestia rozbudowy testów w PR#13. Nowe rozszerzenia wynikają z wymagań właściciela i dostarczonego porównania.
