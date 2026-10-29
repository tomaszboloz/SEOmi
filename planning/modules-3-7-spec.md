# Moduły 3–7 + HSS — spec wiążąca (rozmowa Gemini, odp. 2). Zero gapów. Dane tylko realne; bez źródła → stan pusty.

Wspólne: silnik TS w src/services/<modul>/ (≤150 linii/plik), zakładka w wynikach crawla, persystencja localStorage per projekt,
HelpTip + 12 języków, sekcja PDF, historia/alerty, testy, coverage ≥98%. Dane stron z Rust crawlera + SFS (Core Topic, TRS, wektory).

## MODUŁ 3 — IGOS (Information Gain & Originality), 0–100, URL + domena
Baseline konsensusu: TOP10 SERP dla subtopiku, akapity, Common Knowledge Set E_common = encje/fakty u ≥50% konkurentów.
Składowe: NER_novel=|(E_d∖E_common)∩E_domain_valid|/|E_d| (valid: cos z Core Topic ≥0.55); EDSI (regex/parser: tabele, pomiary, jednostki, daty badań,
cytowania DOI/PubMed, własne wykresy); FHEM (markery doświadczenia pierwszoosobowego: „w naszych testach…”, „u 40% naszych pacjentów…”); D_KL
(KL/cos rozkładu tematów dokumentu vs średni szablon TOP10).
IGOS=(0.35·NER_novel+0.30·EDSI+0.20·FHEM+0.15·D_KL)×100.
UI: wynik + pasek „% powielony konsensus (Echo) vs % unikalny wkład”; mapa cieplna oryginalności per sekcja H2 (⚪ niska / 🟢 ★ wysoka) z uzasadnieniem
(ile z 10 konkurentów ma to samo; brakujące encje u X%); rekomendacje (+pkt): tabela własnych pomiarów, brakujące niszowe encje, własne zdjęcia.
Dane: page_information_gain {igos, consensus_overlap_ratio, novel_entity_ratio, empirical_data_score, experience_markers_score, novel_entities_found, redundant_sections}.

## MODUŁ 4 — SPRS (Semantic PageRank & Link Equity Simulator)
W(u→v)=P_DOM·Sim_vec(V_u,V_v)·Sim_ctx(V_context,V_v). P_DOM: link śródtekstowy w pierwszych 30% treści 1.0; dalej w treści 0.75; box „Zobacz też” 0.35;
nawigacja/okruszki 0.25; sidebar/stopka 0.05. Sim_ctx: zdanie ±15 słów wokół anchora vs strona docelowa.
SPR(v)=(1−d)/N + d·Σ_{u∈B(v)} SPR(u)·W(u→v)/Σ_{k∈Out(u)}W(u→k), d=0.85 (iteracyjnie; sparse; normalizacja 0–100).
Anomalie: PageRank Hoarding/ślepy zaułek (wysoki SPR przychodzący, 0 linków wychodzących w treści), niedożywione Pillary (under-linked), Link Leak
(% mocy do off-topic/technicznych), „złodziej SPR” (TRS niski, SPR wysoki).
UI: tabela URL | rola | SPR | status; symulator What-If (checkboxy: dodaj/usuń link; wynik „SPR 28→79 (+51)”).
Dane: semantic_pagerank_nodes {raw_pagerank, semantic_pagerank_score, is_dead_end, is_underlinked_pillar, link_leak_ratio}.
Rust: potrzebna pozycja linku w DOM (fold 30%, kontener nav/aside/footer/related) i zdanie wokół anchora.

## MODUŁ 5 — EETV (E-E-A-T & Entity Trust Verifier)
Wagi: Schema Graph 30% (spójność JSON-LD: Organization/Person z @id, sameAs → Wikidata/ORCID/ResearchGate/rejestry/LinkedIn/Wikipedia; MedicalWebPage,
reviewedBy, lastReviewed, citation); Author Topical Alignment 25% (cos wektora bio autora vs V_core); Outbound Citation Quality 25% (.gov/.edu/PubMed/NCBI/
WHO/towarzystwa naukowe, martwe 404, niewiarygodne); Trust & Editorial Transparency 20% (polityka redakcyjna, metodologia, dane rejestrowe, adres/kontakt,
data aktualizacji/historia zmian). YMYL: wykrywanie kategorii (zdrowie/finanse/prawo); błąd krytyczny gdy artykuły YMYL bez imiennego autora/recenzenta;
medical claims bez pokrycia.
UI: Trust Score + lista encji autorów/wydawcy (✓/✗ sameAs, zgodność z Core Topic %), „Redakcja” jako błąd, % artykułów z bibliografią/datą weryfikacji,
generator gotowego JSON-LD (Person + MedicalWebPage) z kopiowaniem. Istniejące: ymyl, JSON-LD parser w crawlerze — wykorzystać.
Dane: domain_eeat_audit {eeat_total, schema_graph, author_alignment, citation_quality, trust_transparency, authors_detected, missing_trust_signals}.

## MODUŁ 6 — SIJA (Search Intent & User Journey Alignment)
8 mikro-intencji: definitional, how_to, troubleshooting, comparison, listicle, tool, transactional, local. Klasyfikacja zapytania/URL + cech DOM.
SSAS(d)=1−‖F_DOM(d)−F_SERP_top5‖/(‖F_DOM(d)‖+‖F_SERP_top5‖) (cechy: tabele, listy, kalkulator JS, karty produktów, długość, układ H2).
Funnel Completeness per filar: TOFU/MOFU/BOFU, ścieżka linków w dół lejka, wąskie gardła (np. 11 TOFU nie linkuje do MOFU). Konflikty formatu (Intent Mismatch)
z rekomendacją (np. kalkulator na górze).
UI: lista konfliktów (strona vs oczekiwanie TOP5, SSAS), wykres lejka z udziałem ruchu (GSC/GA jeśli połączone) i ostrzeżeniami.
Dane: page_intent_and_rag {detected_page_intent, dominant_serp_intent, funnel_stage, intent_alignment_score (SSAS)}.

## MODUŁ 7 — AIO-R (AI Overviews & RAG Readiness)
Symulacja chunkingu: sekcje H2/H3 + okna przesuwne ~300 tokenów. Chunk Self-Containment (koreferencje: wiszące zaimki na początku akapitu bez
jawnej encji; Answer-First: pierwsze 40–60 słów pod H2/H3 = kompletna odpowiedź). SPO Fact Triples Density (⟨Encja, relacja, wartość⟩ / liczba słów).
Formatting Extractability (<table>/<thead>/<tbody>, <ol>, <dl>). AIO-R=(0.45·Self_Containment+0.35·SPO_Density+0.20·Extractability)×100.
UI: AI Citability Score (+etykieta ryzyka), symulacja chunków (zły akapit → wynik, błędy RAG, zoptymalizowany wariant — przez ai_generate_text),
lista słabych pasaży (weak_rag_passages). Dane: aio_readiness_score, chunk_self_containment, spo_fact_density. Istniejące: moduł llms.txt/AI visibility — spiąć.
Języki: heurystyki zaimków/odpowiedzi dla 12 języków (przynajmniej en/pl pełne, reszta reguły podstawowe + oznaczenie).

## HSS — Holistic Semantic Score (na szczycie)
HSS=0.20·SFS+0.25·TAS+0.15·IGOS+0.15·SPRS+0.10·EETV+0.10·SIJA+0.05·AIO-R (brak modułu → renormalizacja wag + oznaczenie niepełnych danych, nie zera).
Workflow użytkownika: 1 SFS czyszczenie → 2 TAS architektura → 3 SIJA format → 4 IGOS+AIO-R treść → 5 EETV uwiarygodnienie → 6 SPRS dystrybucja mocy.
