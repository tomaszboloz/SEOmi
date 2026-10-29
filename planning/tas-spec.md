# Topical Authority Score (TAS) — spec wiążąca (z rozmowy Gemini, odp. 1; zero gapów)

Integracja z SFS (`src/services/siteFocus/`): TAS startuje po SFS (Core Topic + TRS stron). Wersja 0.4.0.

## Metryki
TAS 0–100 (witryna/klaster główny); TCR 0–100% (pokrycie taksonomii); ESD/CDES 0–100 (głębokość encji, URL/klaster/witryna);
SCS/SILC 0–100 (spójność silosów); CVFF 0–100 (świeżość + brak kanibalizacji); Semantic Cannibalization Index 0–100%;
Topical Maturity Quadrant (4 kategorie, osie SFS×TAS).

## Algorytm
Krok 1 Reference Topic Taxonomy dla Core Topic: 3 poziomy (Core → Pillar → Subtopic). Źródła: Wikidata/KG (opcjonalnie),
nagłówki H1–H3 TOP 20 SERP, People Also Ask, Google Suggest, related searches. Waga ważności I_j∈(0,1] (częstość u liderów TOP10,
wolumen, centralność). Cache 30 dni. Bez danych zewn. → stan „połącz źródło”, NIE wymyślać (zasada jak benchmark SFS: DataForSEO /
Bing RSS). Tryb Emerging Topics: Live SERP/News entity extraction → tymczasowy graf.
Krok 2 filary:
- TCR = Σ I_j·Cov(s_j) / Σ I_j ×100; strony tylko z TRS≥60; Cov=1 gdy cos≥0.78, 0.5 gdy 0.60≤cos<0.78, inaczej 0.
- CDES: Depth(d)=0.4·|E_d∩E_ref|/|E_ref| + 0.35·PAA_Coverage + 0.25·InfoGain; średnia ze stron on-topic ×100.
  (NER → lokalnie: encje leksykalne/n-gramy; opcjonalny model.)
- SILC=(0.45·Cluster_Conn + 0.35·Anchor_Align + 0.20·(1−Orphan_Ratio))×100. Anchor: „kliknij tutaj/czytaj więcej” waga 0.1,
  deskryptywny 1.0. Orphan penalty; semantic bleed = link z on-topic do TRS<40. Linki tylko z treści (bez menu/stopki).
- CVFF=(0.6·Freshness_Ratio + 0.4·(1−Cannibalization_Index))×100; lastmod/daty publikacji.
Krok 3: TAS_raw=0.35·TCR+0.30·CDES+0.25·SILC+0.10·CVFF; μ_SFS=0.7+0.3·SFS/100; TAS=round(TAS_raw·μ_SFS).
Kwadranty: 1 Niszowy Lider SFS75–100&TAS75–100; 2 Wąski Specjalista/Zalążek SFS75–100&TAS0–74; 3 Rozproszony Gigant SFS0–74&TAS60–100;
4 Chaotyczny Horyzont SFS0–74&TAS0–59.
Kanibalizacja: ≥2 URL na jednym subtopiku lub cos≥0.88 + zbliżone H1 → grupa; kanoniczny = wyższy TRS, więcej linków wewn., głębsze encje; similarity>0.88.
Programmatic SEO: deduplikacja szablonowa → 1 węzeł subtopiku, nadmiar do ostrzeżeń (Crawl Budget Waste).
Mikro-nisza: TCR względem dynamicznego M.
Pusty autorytet: pokrycie wysokie, średnia głębokość encji <30 → ostrzeżenie „Pusty Autorytet”.

## UI
1. Dual Hero (SFS | TAS, cel 80+, kolor/etykieta) + Macierz Dojrzałości (scatter SFS×TAS, gwiazdka „TY”, 4 kwadranty).
2. Dekompozycja 4 filarów z opisem (np. „Pokryto 42 z 72 subtopików”, „9 osieroconych i 14 słabych anchorów”, „2 konflikty”).
3. Mapa pokrycia: filary → subtopiki, ikony ✓ pokryty / ~ płytki / ✗ luka (krytyczna/wysoka/średnia) / ⚡ kanibalizacja; filtry
   Wszystkie filary | Tylko luki | Kanibalizacja; klik w lukę → kreator briefu.
4. Drill-down subtopiku: TRS, Entity Depth, spójność linkowania, encje obecne X/Y i brakujące (% liderów), brakujące PAA, audyt linków
   (brak linku do Pillar, prawie-orphan, link do off-topic).
5. Tooltips (HelpTip, 12 języków): TCR, ESD, SCS, macierz SFS×TAS (+ TAS, SILC, CVFF, kanibalizacja).
## Rekomendacje (Topical Expansion Engine, delta TAS)
Site-wide: (1) wypełnij krytyczne luki klastra (potencjał +N TAS, plan artykułów Pillar/Cluster, auto-briefy encji), (2) połącz
skanibalizowane (301, aktualizacja linków; +TAS +SFS), (3) napraw linkowanie (orphany → Pillar, usuń linki do off-topic).
Playbooki: Typ A luka (URL, H1, Entity Checklist, linki in/out, wpływ TAS); Typ B płytki Depth<50 (brakujące atrybuty E-A-V, sekcja PAA,
czas, wzrost Depth); Typ C kanibalizacja (intent similarity, konsolidacja, 301, zmiana linków).
## Dane / persystencja
localStorage per projekt (jak siteFocus) zamiast SQL: reference graph, coverage mapping, link silos, cannibalization groups, historia TAS.
## Edge cases: mikro-nisza, programmatic SEO, treści AI bez wartości (Pusty Autorytet), emerging topics.
## Benchmark (V2.0): Topical Gap Matrix vs TOP 3 SERP (SFS, TAS, pokrycie filarów) — tylko realne dane.
## Monitoring: historia SFS+TAS (dual timeline z kamieniami milowymi), alerty: kanibalizacja pre/post-publish (>85% pokrycia wektora),
Competitor Radar (nowy klaster konkurenta), Content Decay (Pillar >12 mies. bez aktualizacji).
## Roadmapa (WSZYSTKO przed wydaniem): MVP macierz+TCR+kanibalizacja+Dual Hero; V1.1 Entity Depth, Silo Cohesion, mapa; V2.0 benchmark, briefy AI, generator silosów.
## Wymogi repo: 12 języków, PDF sekcja, testy, tsc/eslint/clippy/check:loc(150)/coverage≥98%, RELEASE_NOTES, bump wersji.
