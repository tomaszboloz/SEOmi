Niezależny lokalny odbiór dalszej poprawki callera #144 zakończony. Paczka nadal pozostaje poza main, wydaniem 0.4.41 i PR #214, który dotyczy wyłącznie publikacji.

Signals używa jawnej wybranej właściwości i filtrów GSC projektu. Osobny marker gotowości hydracji blokuje wynik w oknie zmiany projektu; test przechodzi rzeczywistą ścieżkę `selectProject → useAppHydration → SignalsWorkspace → hook → adapter` z opóźnionym odczytem i późnym wynikiem poprzedniego projektu. Atrapy obejmują I/O, bez zastępowania hooka ani adaptera.

Audyt odrzucił wcześniejszą wersję, która dopuszczała szerszą root/domain property, oraz kolejną normalizację zrównującą `/blog` z `/blog/`. Oba przypadki naprawiono: dla jawnego wyboru GSC wymagane jest dokładne dopasowanie tożsamości, bez szerszej, sibling ani innej subdomeny. Ścieżka URL-prefix zachowuje końcowy slash; brak zgodnego źródła pozostaje null/inconclusive. Stary matcher page-URL pozostaje dla dotychczasowych callerów.

Zamrożony zbiorczy patch v3: SHA256 `59c1d4b48e237623be5eed9906ff12c4aa39d70a61c431504f842f66ab233543`, 11 zmienionych plików. Na czystym checkout `2feed171e27c29757fb5aacb49f6fca202b8d871` nałożono ten patch oraz odebrane 13 plików testów Gemini. Wszystkie 24 hashe paczek zgodne; w pełnym pomiarze pozostało stabilnych 4419 hashy źródeł.

Wynik tej kombinacji lokalnej: **1392 suites / 11432 tests PASS**, typecheck, pełny lint, MAX150, version i diff PASS. Pokrycie frontendu: lines100%, statements99.97%, functions99.98%, branches99.83%. To wynik wskazanej kombinacji, nie samego main ani dowód globalnego100%. Zewnętrzne market I/O było kontrolowane w testach; nie deklarujemy live-provider odbioru ani twierdzeń przyczynowych.

Źródła i raporty zachowane; tymczasowy checkout audytu zarchiwizowany odzyskiwalnie. Issue pozostaje OPEN do właściwej integracji i zdalnego CI końcowego SHA. Progi95/98/MAX150 bez zmian.
