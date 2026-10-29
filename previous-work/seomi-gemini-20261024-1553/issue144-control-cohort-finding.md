Nowy niezależny audyt lokalnego kandydata #144 wykazał nieporównywalną grupę kontrolną. Oryginalny produkcyjny adapter i zależności wykonano po transpilacji, bez edycji źródeł i bez sieci; atrapy dotyczą wyłącznie odczytu magazynu.

Witryna testowa: country=pol, device=DESKTOP, search_type=web. Niezależna domena kontrolna: country=usa, device=MOBILE, search_type=image. Przy takich samych datach adapter wybiera tę niezgodną kohortę i zwraca `negative`, effect=-40, reason=null. Niezależność domeny nie dowodzi zgodności filtrów. Przypadek kontrolny z tym samym krajem/urządzeniem/typem wyszukiwania i wspólnym spadkiem40% poprawnie daje `no-effect`, effect=0.

Hash adaptera: `51791310af1b7e6d182c9000260acf334195684a56dbeb70d812dcc27f742145`. Wykonawca Gemini dostał odtwarzalny test i naprawę wyboru kohort: niezgodne filtry nie mogą dawać rozstrzygającego wyniku; bez zgodnej niezależnej kontroli wynik pozostaje inconclusive/control-unavailable. Wymagane osobne regresje kraju, urządzenia, typu wyszukiwania i dodatnia kontrola zgodności, bez osłabienia wcześniejszych sześciu przypadków.

Aktualna paczka pozostaje lokalna; nie weszła do PR #209 ani main.100% pokrycia nie zastępuje tej kontroli semantycznej. Progi95/98/MAX150 bez zmian.
