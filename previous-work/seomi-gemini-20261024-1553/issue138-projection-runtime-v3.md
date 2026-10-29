Wykonany audyt oryginalnego `loadCrawlRuns → replay → sqliteEventSink` wykazał dwie dalsze luki. Atrapy dotyczą granic snapshot store i native IPC; produkcyjny odczyt oraz projekcja wykonały się bez edycji źródeł.

Gdy istnieje starszy ukończony snapshot oraz nowsze zdarzenia aktywnego crawla, `loadCrawlRuns` zwraca tylko stary wynik. Wykonuje zapytanie wyłącznie dla starego runId i nigdy nie pyta o nowy trwały run. Poprawiony helper replayLatest nie jest wówczas wywoływany. Bez starego snapshotu nowy run wraca, lecz health_score i duration_ms są `Number.NaN`, a nie poprawnym nullable/unknown. JSON serializuje NaN do null, dlatego niezależny raport sprawdza także `Number.isNaN`, aby nie przedstawić tego jako uczciwego stanu niedostępności.

Nowy test SQLite query_only ON → append Err → OFF → retry weryfikuje sensowną naprawę sekwencji. Nadal potrzebny jest dowód rzeczywistego pending crawl command/pipeline i odczytu po restarcie; ręczne wywołania record_started/page nie zastępują tego testu. Wynikowy run w toku musi zachować realne strony i tożsamość oraz jawny stan interrupted bez NaN i wymyślonych liczników.

Uwagi i wykonywalny reproduktor przekazano temu samemu wykonawcy Gemini High. Zakres #138 pozostaje poza integracją/main; issue OPEN, bramki 95/98/MAX150 bez zmian.
