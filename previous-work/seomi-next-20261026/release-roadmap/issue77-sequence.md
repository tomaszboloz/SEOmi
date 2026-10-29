Zgodnie z nowym poleceniem właściciela kolejność wydań to **0.5.0 → 0.6.0**. Utrzymujemy istniejące milestones i ich kryteria, zamiast utożsamiać zmianę numeru z ukończeniem produktu.

| Wydanie | Zakres GitHub | Warunek przejścia dalej |
|---|---|---|
| [0.5.0 AI & Trust](https://github.com/tomaszboloz/SEOmi/milestone/3) | #63, #64, #65, #66, #87, #88, #108, #109 | Pełne callery/źródła/UI/PDF, profile i brak-danych, 12 języków, niezależny odbiór i exact-SHA CI/artefakty |
| [0.6.0 Originality, Intent & Link Flow](https://github.com/tomaszboloz/SEOmi/milestone/4) | #67, #68, #69, #70, #71 | Dopiero po odbiorze i publikacji 0.5.0; reuse wspólnych warstw #106 oraz profili/kontraktów/źródeł |

6 agentów Codex otrzymało rozdzielone ownership: AIO core/profiles/alerts; AIO rewrite i JSON-LD UI; EETV core/history; identity/citation evidence; crawl persistence/snapshot lifecycle; niezależny audyt/release acceptance. Dokończenie YMYL/economy (#137) i źródeł/projekcji (#138) jest oceniane jako zależność wiarygodnych ścieżek. Przygotowane patche późniejszych modułów #139/#143 i częściowe #131 zachowujemy osobno; nie zamykamy ich przez samo planowanie.

6 rozmów Gemini High wykonuje proste testy i konkretne braki pokrycia w osobnym checkoutcie, bez zmian kodu produkcyjnego i bramek. Pierwsza tura dała17 plików/249 testów:248PASS i1 błędną asercję CSV skierowaną do poprawy; type/lint/MAX150PASS. To nie jest dowód pełnej realizacji milestone.

Obecny [PR #219](https://github.com/tomaszboloz/SEOmi/pull/219), kandydat0.4.43 `70a562c48674b6add386874756f43fc53b9bc1d6`, pozostaje stabilizacyjną podstawą: lokalne1399suites/11490testsPASS, lines100%/branches99.78%, natywnyARMUI21/IPC199/renderer48PASS. ZdalneCI i poprzedzający publishing-fix#218 nadal trwają. Żadne z8issues0.5.0 nie jest na tej podstawie oznaczane jako ukończone.

Bramki Rust95%, frontend/MCP98%, MAX150, security, zachowanie danych i ręczna akceptacja zmian pozostają bez zmian. Odbiór100% jest osobnym pomiarem zakresu i wszystkich metryk dla dokładnegoSHA, a nie samą liczbą testów ani100%linii. Publikacja obejmie sprawdzenie prawdziwych paczek Windows/macOS, podpisów, updatera i provenance; brak źródła pozostaje unavailable/unknown.
