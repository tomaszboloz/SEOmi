# Macierz funkcjonalna SEOmi

Stan odniesienia: publiczny sitemap i aktualny checkout referencyjnego repozytorium z 2026-09-20. „UI” oznacza dostępny ekran; nie jest synonimem gotowego źródła danych.

| Obszar | Widok SEOmi | Dane rzeczywiste | Status |
| --- | --- | --- | --- |
| Project workspace | project gate i switcher | lokalne, per projekt | częściowo |
| URL audit | page audit | Rust HTTP/parser | gotowe |
| Keyword research | keyword workflows | częściowo, wymaga integracji | luka |
| Keyword clustering | osobne zadanie w keyword workflows | realny top-100 SERP per fraza, URL overlap z dowodami, ustawienia/wynik per projekt | częściowo; live E2E DataForSEO nieuruchomione |
| Saved keywords | saved keywords | lokalne, per projekt | częściowo |
| Rank tracking | rank tracking | brak odświeżenia API | luka |
| Domain overview | domain research | DataForSEO Labs: metryki organiczne, top pages i competitors; testy kontraktowe, bez live E2E | częściowo |
| Backlinks | backlink checker | summary + paginowane backlinki i anchory (100 na stronę); live E2E nieuruchomione | częściowo |
| Backlink gap | osobne zadanie w backlink checker | Domain Intersection na real API: konkurenci w targets, własna domena w exclude_targets, subdomeny opcjonalnie, wynik partial i paginacja; live E2E nieuruchomione | częściowo |
| Site audit | crawler + 12 zakładek wyników | Rust crawler; ręcznie uruchamiany batch checker linków zewnętrznych (limity, live progress, SSRF guard, status/redirect/transport zapisane w runie i CSV); brak browser-render crawl i globalnego grafu linków | częściowo; brak E2E macOS/Windows |
| AI brand visibility | AI visibility | brak zaufanego live provider workflow | luka |
| Prompt explorer | prompt explorer | brak rzeczywistego wykonania porównań | luka |
| Agent/MCP | workflow hub | lokalny stdio MCP: URL audit, keywords, SERP, backlinks | częściowo |
| Search Console | Search Console hub | OAuth PKCE, systemowy token per projekt, property list, live query/page metrics stronicowane do 25 tys. wierszy na wymiar i URL Inspection; wymaga własnego Google OAuth Client ID i live E2E | częściowo |
| PageSpeed Insights | osobne Performance Research | native Google PSI API: Lighthouse categories, lab metrics i opportunities; klucz keychain per projekt, wymagane live E2E | częściowo |
| CrUX / Core Web Vitals | osobne Performance Research | native Chrome UX Report API, URL/origin i form factor, p75/category/histogram, source/window; wymagane live E2E | częściowo |
| Free utilities | osobne narzędzia | brak pełnego zestawu | luka |
| Raporty i współdzielenie | brak | brak | luka |

## Kryterium 100%

Wynik może zostać oznaczony jako 100% wyłącznie wtedy, gdy każdy wiersz ma status „gotowe”, odpowiadający test integracyjny oraz test E2E; ekrany z generowanymi danymi nie mogą być zaliczone. Aktualny stan nie spełnia tego kryterium.
