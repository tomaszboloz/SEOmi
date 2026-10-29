CI dla zintegrowanego HEAD `4549007c6513b280809ba735b79deb7e04da0486` ujawnił4 starsze testy spoza lokalnego odbioru112testów: frontend job121126023786 w run https://github.com/tomaszboloz/SEOmi/actions/runs/40179076946 ma11040PASS/4FAIL.

Dwie fixture (`coverage100PersistenceFollowupTasks`, `execWiringServices`) oczekują verified, ale nie podają implementedAt ani rozpoczęcia crawla. Nowa produkcyjna kontrola słusznie odracza taki wynik. Pozostałe dwa testy pinują pełny kontrakt i wykrywają wyłącznie dodane `CrawlRunRecord.startedAt?: string`.

Zlecono Gemini poprawę dodatnich fixture z prawdziwą kolejnością dat oraz jawny test zgodności legacy bez daty. Przegląd deklaracji i test nowego opcjonalnego pola mają zachować wszystkie pozostałe120kontraktów, liczbę eksportów i pełne asercje. Bez cofania freshness guard, pomijania testów albo zmiany progów95/98/MAX150. Root ponownie sprawdzi poprawkę w izolacji przed nowym CI. Issue pozostajeOPEN.
