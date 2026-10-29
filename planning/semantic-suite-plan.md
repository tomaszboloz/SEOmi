# Semantic SEO Suite — plan luk po SFS (źródło: rozmowa Gemini 63506986e862a6fb)

Stan: SFS (moduł 1) wdrożony w 0.3.0. Reszta rozmowy = 6 kolejnych modułów + dashboard + architektura.
Odczytano: nagłówki wszystkich 10 odpowiedzi; pełny tekst tylko odp. 1 (SFS). Przed każdym modułem
trzeba przeczytać jego sekcję w rozmowie (formuły, progi, UI) — NIE zgadywać.

## Moduły
| # | Moduł | Skrót | Odp. w rozmowie | Status |
|---|-------|-------|-----------------|--------|
| 1 | Site Focus Score | SFS | 0 | zrobione (0.3.0) |
| 2 | Topical Authority Score (TCR, ESD, SCS + 4. filar; macierz SFS×TAS; graf referencyjny taksonomii; luki encji) | TAS | 1 | do zrobienia |
| 3 | Information Gain & Originality Score (encje/akapity vs top SERP) | IGOS | 2 + kod Py (Q5) | do zrobienia |
| 4 | Semantic PageRank & Link Equity Simulator (SciPy sparse → w TS/Rust) | SPRS | 2 + kod Py (Q8) | do zrobienia |
| 5 | E-E-A-T & Entity Trust Verifier (walidacja JSON-LD, sameAs, powiązania) | EETV | 2 + kod Py (Q6) | do zrobienia |
| 6 | Search Intent & User Journey Alignment (8 mikro-intencji) | SIJA | 2 + kod Py (Q7) | do zrobienia |
| 7 | AI Overviews & RAG Citability Readiness (chunking hybrydowy, wiszące zaimki, Answer-First, trójki SPO, ekstraktowalność) | AIO-R | 2 + kod Py (Q4) | do zrobienia |
| – | Globalny wskaźnik zbiorczy + SQL dla modułów 3–7 | – | 2 | do zrobienia |
| – | Executive Dashboard UX/UI łączący 7 modułów + przepływ pracy | – | 9 | do zrobienia |
| – | Architektura systemowa (mikroserwisy, Celery/Kafka, Qdrant/pgvector) | – | 4 | NIE dotyczy (desktop Tauri) — mapować na lokalne odpowiedniki |

## Zasady adaptacji (jak przy SFS)
- Python → TS (`src/services/<modul>/`), dane stron z Rust crawlera; embeddingi opcjonalne (Ollama), domyślnie leksykalnie.
- SQL → localStorage per projekt (jak `siteFocus`); kolejki/mikroserwisy → workery + istniejący scheduler.
- Każdy moduł: silnik + testy, zakładka w wynikach crawla, HelpTip, 12 języków, sekcja PDF, alerty, historia.
- Gates: tsc, eslint, check:loc (150), coverage ≥98%, clippy, parity i18n.
- Kolejność: 2 TAS (zależy od SFS) → 7 AIO-R (sam tekst, najmniej zależności) → 3 IGOS → 5 EETV → 6 SIJA → 4 SPRS → wskaźnik zbiorczy → dashboard.
- Wersje: 0.3.0 wypchnąć najpierw (blokada: `gh auth switch -u tomaszboloz`); potem każdy moduł = osobne wydanie (0.4.0 …).
