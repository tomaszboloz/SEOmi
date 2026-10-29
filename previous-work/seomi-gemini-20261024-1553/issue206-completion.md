Poprawka jest już scalona do main przez #208 → #209 → #176, commit main `4a25a1974d9641a6170c0802919a566e55251071`.

`CrawlResultsTabStrip` nadaje każdej zakładce jawną nazwę `aria-label` z lokalizowanej etykiety i licznika oddzielonych spacją. Zachowano wybrany tab, panel, klawiaturę, licznik i istniejące tłumaczenia. Oryginalna regresja nadal wymaga dokładnego `Metadata 2`, nazwy Overview z licznikiem oraz utrzymania wybranego facetu po ponownym renderze.

Świeży niezależny odbiór:30/30testów w trzech zestawach (regresja facetu, nawigacja klawiaturą i taby), hashe stabilne. Źródło oraz wszystkie trzy testy są identyczne na main4a25a197 i bieżącym kandydacie2e1abc7. Typecheck/lint/MAX150/version/source-policy obecnego kandydata PASS. Pełny frontend98 i Windows/macOS Intel końcowego wcześniejszego HEADcd946af zakończyły się SUCCESS w [CI PR](https://github.com/tomaszboloz/SEOmi/actions/runs/40236604931) i [CI push](https://github.com/tomaszboloz/SEOmi/actions/runs/40236599379); jego całe drzewo jest identyczne z obecnym main4a25a197.

Zamykam odebrany błąd dostępnej nazwy. Publikacja0.4.41 nadal oczekuje na osobną poprawkę odczytu dowodów CodeQL w #213 oraz jej pełne CI. Progi95/98/MAX150 bez zmian.
