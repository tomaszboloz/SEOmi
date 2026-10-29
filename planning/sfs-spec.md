# Site Focus Score — specyfikacja (skrót wiążący; wszystkie punkty do wdrożenia, zero gapów)

Metryka 0–100 spójności tematycznej domeny/sekcji. Plan integracji: docs/site-focus-score-plan.md.

## Metryki
SFS (0–100, witryna/kategoria), TRS (0–100, URL), Core Topic Confidence (0–100%), Keyword Coverage/Overlap (0–100%), Semantic Drift (0–100%), On-topic Ratio (% stron z TRS ≥ 60).

## Algorytm
Krok 1 Core Topic: ekstrakcja z title/H1–H6/body/alt/meta description; wagi stref title,H1 ×2.5; H2–H3 ×1.5; body ×1.0; n-gramy 1–4; lematyzacja + stop words wg języka; TF-IDF(t,d,D)=TF·log(N/df); top ~500 n-gramów → klastry (agglomerative / K-Means z silhouette; wersja leksykalna: współwystępowanie; opcjonalnie embeddingi); W(C_k)=ΣΣ TF-IDF; największy = Core Topic, centroid V_core; Core Topic Confidence = W(max)/ΣW. Manual override (użytkownik wpisuje temat → przelicza centroid i wszystkie TRS od razu).
Krok 2 TRS strony: Similarity=cos(V_d,V_core) (0.8–1 silna, 0.5–0.79 umiarkowana, <0.5 słaba); KeywordOverlap=|K_d∩K_core|/|K_core| (K_core = top 30–50 terminów klastra); SemanticDrift = Σ TF-IDF terminów z obcych klastrów / Σ TF-IDF wszystkich terminów strony (+ weryfikacja kolokacji dla polisemii, np. „zdrowie baterii smartfona” → TECHNOLOGIA). TRS_raw=0.5·Sim+0.3·Overlap−0.2·Drift; TRS=clamp(0,100,TRS_raw·125).
Fallback (język nieobsługiwany przez embeddingi / brak danych): TRS=0.75·Overlap−0.25·LexicalDrift (×125 clamp), z notą w UI: „Analiza dla wybranego języka wykorzystuje algorytm statystyczny TF-IDF. Komponent głębokiego podobieństwa semantycznego jest niedostępny – wynik bazuje na pokryciu i dystrybucji słów kluczowych.”
Krok 3 SFS = Σ w_i·TRS_i / Σ w_i. Wagi: homepage 3.0; kategorie/sekcje/pillar/hub 2.0; artykuły/wpisy/karty produktów 1.0; techniczne (polityka prywatności, regulamin, kontakt, o nas, logowanie – wzorce URL + klasyfikator treści) 0.1.
Pasma SFS: 90–100 wyjątkowa koncentracja (ciemnozielony); 75–89 silny (zielony); 60–74 umiarkowany (żółty); 40–59 słaby (pomarańczowy); 0–39 brak spójności (czerwony). Każde z interpretacją SEO.

## UI (Progressive Disclosure)
1. Hero Metric: duża liczba, progress bar, kolor wg pasma, podsumowanie („…N podstron znacząco odbiega”), tooltip metadanych (liczba stron, czas ostatniej aktualizacji, przycisk „Przelicz ponownie”), link „Jak to działa?” → boczny Drawer z diagramem wag i wzoru TRS.
2. Core Topic Panel: etykieta tematu, 5 top terminów z % reprezentacji, „Pokrycie: X% treści witryny ściśle związane”, przycisk „Czy to nieprawidłowy temat?” (manual override).
3. Topic Distribution Heatmap: drzewo URL (home → sekcje → strony) z paskami TRS (zielony ≥75, żółty 60–74, czerwony <60), ⚠ przy TRS<60 (z filtrem ignorowania stron technicznych), filtry: Wszystkie (N) | Krytyczne <40 | Na granicy 60–74 | Silne ≥75; klik → widok szczegółowy.
4. Analiza strony: TRS, status (np. SILNIE OFF-TOPIC), „Dlaczego ten wynik?” (podobieństwo, pokrycie słów, drift z obcymi tematami i %), słowa zgodne/niezgodne z Core Topic z licznikami i kontekstem, rekomendacje.
5. Keyword Alignment Matrix: keyword | freq | core-topic relevance | alignment (✓ >70%, ~ 40–70%, ✗ <40%).
6. Tooltips (HelpTip, 12 języków): Semantic Similarity, Keyword Overlap, Semantic Drift (oraz SFS, TRS, Confidence, On-topic Ratio) z przykładami wg specyfikacji (drift >50% = czerwona flaga; overlap >60% silny, <30% off-topic).

## Rekomendacje (Delta Score Simulation, priorytet zysk/nakład)
Site-wide: (1) usuń/przenieś N stron off-topic (potencjał +X pkt, lista najgorszych, noindex/usuń linki), (2) wzmocnij strony „na granicy” 60–74 (brakujące terminy, sekcje, wzrost 68→82), (3) rozbuduj Core Topic Cluster (luki tematyczne, plan contentu z priorytetami).
Page-level playbooks: Typ A TRS<40 (opcje: usuń+301 / noindex+izolacja / przekształć w on-topic z briefem, czas, potencjalny wynik); Typ B 60–74 (brakujące terminy, wzmocnienie H2/H3, głębokość tematyczna); Typ C ≥75 (internal linking jako hub, klaster satelitarny, monitoring co 6 mies.).
Przy is_low_confidence – bez agresywnych rekomendacji usuwania.

## Edge cases
1. Multi-topic (żaden klaster >50%, 2–4 zbliżone, zgodne ze strukturą katalogów URL): is_multi_topic=true, Sub-site Focus Score na kategorię, dashboard „Wykryto N obszarów…”, overall, rekomendacja subdomen.
2. <10 stron: is_low_confidence=true, ostrzeżenie „Mała próbka danych (N stron)…”, zalecenia (20–30 stron, ponowna analiza za 2–4 tyg.), brak agresywnych rekomendacji.
3. Język bez embeddingów: fallback statystyczny + nota.
4. SPA/JS: strony z render_status js_timeout pomijane w średniej, komunikat „N podstron pominięto w analizie z powodu przekroczenia czasu renderowania JavaScript”; wykorzystać istniejący rendered crawler (pole statusu renderu).

## Benchmark konkurencji (Stage 3)
Porównanie SFS z TOP 10 SERP dla fraz Core Topic: ranking, średnia branżowa, insighty (% treści on-topic, liczba stron off-topic, keyword coverage vs top 3), cel (np. 80+). Wyłącznie na realnych danych: SERP przez istniejącą integrację (DataForSEO / custom search, klucz użytkownika); crawl konkurentów istniejącym crawlerem (limit stron); bez danych → stan pusty „połącz źródło”, nie wymyślone liczby.

## Monitoring (Stage 2)
Incremental (nowe/zmienione strony oceniane względem istniejącego V_core), pełna re-analiza co tydzień, ręczny trigger z limitem 3 pełnych przeliczeń dziennie na projekt. Historia SFS (wykres liniowy z adnotacjami kluczowych zmian: usunięcie stron, nowy klaster, optymalizacja). Alerty: spadek SFS >5 pkt między pełnymi analizami (e-mail+in-app → wykorzystać desktopNotifications/monitoringAlerts); Content Guard (nowy URL z TRS<40 w ciągu 24h); raport tygodniowy z 3 najpilniejszymi zadaniami.

## Roadmapa
Etap 1 (MVP): Hero, Core Topic, tabela off-topic z TRS, podstawowe rekomendacje. Etap 2: heatmapa, matrix, widok strony z drift, historia. Etap 3: benchmark, Topic Cluster Gap Analysis, generator briefów AI (ai_generate_text), silnik rekomendacji linkowania wewnętrznego. WSZYSTKO ma być wdrożone przed wydaniem.

## Decyzje projektowe (aplikacja desktopowa Tauri)
- Zamiast SQL: zapis wyników w rekordzie runu / pliku projektu (crawl_storage), historia SFS per projekt.
- Silnik w TS (`src/services/siteFocus/`), deterministyczny, testowany; Rust dostarcza dane strony (liczniki terminów z wagami stref, teksty nagłówków, alt, status renderu).
- Embeddingi opcjonalne (Ollama, `services/embeddings`), domyślnie leksykalnie.
- Wszystkie napisy UI/PDF/Help w 12 językach (en, pl, es, de, fr, it, pt, ru, ja, zh, ko, ar).
- Każda zmiana: testy (vitest/cargo), tsc, eslint, clippy czyste; wersja 0.3.0 + RELEASE_NOTES.
