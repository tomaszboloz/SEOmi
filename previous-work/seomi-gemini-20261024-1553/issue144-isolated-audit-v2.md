Izolowany odbiór paczki #144 na czystym ec44974140a8f26ada613ec7fb0aae92d5b32397: patch nałożony poprawnie, wszystkie16hashy zgodne z manifestem.18zestawów dało146PASS/8FAIL; źródła pozostały niezmienione podczas pomiaru. W paczce brakuje podłączenia SignalsWorkspace (nadal przekazuje result=null) i wymaganych tłumaczeń causalMarket w12językach. Wyniki z szerokiego lokalnego dirty tree nie kwalifikują niekompletnego patcha.

Wykonanie oryginalnego adaptera TS ujawniło dalszy błąd wyboru właściwości GSC:
- żądany https://example.com/blog/, dostępne tylko /store/ i niezależny control: negative/-40 zamiast braku dowodów dla wskazanej property;
- żądany app.example.com, dostępne tylko www.example.com i control: ten sam fałszywy negative/-40;
- exact /blog/ ze stabilnymi obserwacjami istnieje, ale /store/ jest pierwszy: adapter wybiera sibling i daje negative/-40 zamiast no-effect0.

Przyczyna: równość registrable domain służy również dopasowaniu testowej property. Nie zastępuje ona tożsamości GSC ani konkretnego URL-prefix. Osobny przypadek źródłowy: jawne end:'invalid' jest zamieniane na end:null, tworząc fikcyjne ongoing Ranking window.

Zachowano wcześniejszą naprawę zgodności country/device/search_type. Nowy kandydat odrzucony do poprawy; oryginalny patch i logi zachowane, checkout integratora przywrócony do czystego ec44974. Audyt Storage.prototype trwa osobno w tej samej rozmowie GeminiHigh/high. Zakres pozostaje poza PR209/main i bez wydania. Progi95/98/MAX150 bez zmian.
