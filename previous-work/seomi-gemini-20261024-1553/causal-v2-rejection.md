NOWY AUDYT ROOT: 16-file causal.144.patch został nałożony poprawnie na czyste ec44974, manifest 16/16 zgodny. 18 zestawów testów: 146 PASS / 8 FAIL, 3 pliki czerwone. Dowody auditor-causal-v2-result.json oraz auditor-causal-v2-0-clean.log. Patch NIE zawiera wiring SignalsWorkspace (nadal result={null}) ani wymaganych 12 locale causalMarket keys. Autorskie testy na szerokim dirty tree nie dowodziły kompletności paczki. Brakuje i18n disclaimer/evidence/marketUnavailable/controlUnavailable/unknown, jest stary empty text. Te brakujące zakresy należy dołączyć OSOBNO od governor/outreach, przez mały wyizolowany patch; nie kopiować pełnych locales/SignalsWorkspace z szerokiego dirty tree.

Root wykonał oryginalny frozen adapter/source na produkcyjnym TS, stubs tylko odczytu storage. audit-causal-property-source-v2.mjs + auditor-causal-property-source-v2-findings.json dowodzą:
1. Żądany GSC https://example.com/blog/, tylko https://example.com/store/ i independent control: fałszywy negative/-40 zamiast null.
2. Żądany app.example.com, tylko www.example.com i independent control: false negative/-40.
3. Właściwy blog/ istnieje, lecz store/ jest pierwszy: nadal wybiera store/ i false negative/-40 zamiast exactproperty no-effect0.
4. GoogleRanking end:'invalid' zamienia na end:null ongoing. Explicit malformed end musi zostać odrzucony; null/missing ongoing zachować. Date regex akceptuje nieistniejące daty, rozważ właściwą walidację dat.

To jest odrzucenie paczki, nie kwalifikacja. Po zakończeniu read-only storage audit dostaniesz etap naprawczy. Root przywraca WYŁĄCZNIE te 16 plików do ec44974, oryginalny patch i manifest zachowane. Nie zmieniaj root ani audytu /tmp. Nie cofaj wcześniejszych mismatchcohort/no-effect/unknown/rawvolatility napraw.
