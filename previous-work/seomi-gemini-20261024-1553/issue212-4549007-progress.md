Poprawka Gemini została odebrana i wysłana do PR #209 w commicie `4549007c6513b280809ba735b79deb7e04da0486`.

Audytor wcześniej odtworzył rzeczywisty błąd produkcyjnego panelu: probe rozpoczęty podczas oczekiwania stop rozstrzygał się w tej samej partii aktualizacji React co udany stop i nadpisywał stopped przez sessionExpired. Poprawka unieważnia odpytywania także przy zakończeniu operacji, używa aktualnej referencji lease i chroni zakończenie stop.

Odbiór po integracji:18/18 testów obejmujących trzy zestawy RenderWorkerPanel i niezależny oryginalny mounted/deferred reproduktor. Rzeczywiste wygaśnięcie, inactive, błędy stop, polling i unmount nadal mają kontrole. Typecheck, pełny lint, MAX150 (panel143linie), version-check i diff-check PASS; hashe źródeł stabilne. Brak retry, sleep, podniesionych timeoutów lub osłabionej asercji stopped.

Świeży CI dokładnego SHA: https://github.com/tomaszboloz/SEOmi/actions/runs/40179076946 — w toku. macOS Intel/Windows i pomiary końcowe pozostają wymagane. Issue pozostaje OPEN do odbioru zdalnego i integracji. Progi95/98/MAX150 bez zmian.
