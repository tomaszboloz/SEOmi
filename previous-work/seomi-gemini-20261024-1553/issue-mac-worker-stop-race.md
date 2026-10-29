Na HEAD PR #209 `d643e0237fa66cfa3d328be0e1bcf787f44d716d` [macOS Intel job120978077998](https://github.com/tomaszboloz/SEOmi/actions/runs/40129531377/job/120978077998) zakończył się błędem frontendowego testu:

`tests/renderWorkerPanelBranches.test.tsx:72` → `starts, shows lease details, then stops the worker`.

Oczekiwano komunikatu `The worker was stopped.`, odczytano `The worker session expired or ended. The token is no longer valid.`. Wynik tej platformy:10962testyPASS/1FAIL,1337zestawówPASS/1FAIL. Windows, osobny frontend, Rustunit/security i zależności/SBOM przechodzą. Coverage followups są SKIPPED po nieudanym prerequisicie. Ten błąd zatrzymał platformę przed potwierdzeniem natywnego testu proxy; nie jest ponowną reprodukcją jego starego ConnectionReset.

Odbiór: ustalić czy przyczyną jest timing fixture czy rzeczywisty stale polling nadpisujący udany stop. Hermetycznie sprawdzić deferred status i stop oraz zegar wygaśnięcia, z zachowaniem odrębnych stanów stopped/sessionExpired/leaseExpired. Poprawić przyczynę i wykazać regresję. Bez retry, sleep, podniesienia timeoutu, skip lub osłabienia asercji statusu. Testy RenderWorkerPanel, typecheck/lint/MAX150/diff oraz świeży exact-SHA CI macOS/Windows wymagane przed scaleniem.

Istniejąca rozmowa Gemini frontend ma priorytet małej poprawki przed dalszymi pracami coverage100. Powiązane #209,#211,#176,#90. Bramki Rust95/frontend-MCP98/MAX150 bez zmian.
