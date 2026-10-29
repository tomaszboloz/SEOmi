PR przygotowuje SEOmi **0.4.41** i naprawia błędy blokujące testy Windows oraz rzetelną kontrolę źródeł przed wydaniem.

- Windows używa natywnego path.relative/isAbsolute po canonicalizacji; regresje obejmują POSIX, dyski Windows, UNC, sibling-prefix i symlinki poza katalogiem. Test workflow normalizuje CRLF.
- Wspólny walidator Node w test.yml i release.yml rozpoznaje dokumenty agentów/planowania bez 22 fałszywych trafień w legalnym kodzie. Skanuje śledzone product roots tym samym wzorcem brandingu, także bajty zasobów. Błąd Git lub odczytu zatrzymuje kontrolę. Usuwa zależność od nieobecnego rg, którego błąd wewnątrz if wcześniej dawał fałszywy PASS.
- Desktop E2E używa lokalnego serwera HTTP i zachowuje ścisłe kontrole dokumentu, renderera oraz SSRF. Wcześniejsze poprawki obejmują CLI stdin, pełną odpowiedź proxy HTTP503 i wyścig stop/probe workera.
- Migracja zależności Rust ma regresje zgodności starszego ciphertextu i izolowanej tożsamości poświadczeń. Causal Market Impact działa w Signals z 12 lokalizacjami; respektuje property/prefiks/filtry i zachowuje nieznane dane oraz relativeEffect=null przy zerowym mianowniku.
- Publisher wymaga jednego draftu, zgodnego tagu i dokładnego SHA, wiąże siedem artefaktów z bajtami remote oraz generuje SBOM, checksumy i inventory przed attestation/publikacją. Zmienia tylko cztery zarządzane metadane; instalatory, podpisy i obce assety są chronione.

Aktualny HEAD: `c16448b72b0d6efe258b4a6ba4f80d8ecc70946e`. [CI tego SHA](https://github.com/tomaszboloz/SEOmi/actions/runs/40227484734) trwa. Lokalne sprawdzenie końcowego patcha: **98/98 testów w 5 plikach**, rzeczywisty Git fixture CLI, typecheck, lint, MAX150, version i diff-check PASS. Hashe **4380 plików** były stabilne. Niezależny audyt obu poprawek bezpieczeństwa PASS.

Pełny lokalny pomiar poprzedniego SHA f2f7bf64: 11160/11160 testów w 1363 plikach; frontend statements99.94%, branches99.81%, functions99.91%, lines99.99%. MCP192 testy/29 plików i100% czterech metryk. Jeszcze wcześniejszy 1b4c9692: 2470 testów Rust all-targets oraz rzeczywisty desktop E2E macOS ARM64 (25 base/199 IPC/48 renderer) PASS. Te wyniki nie zastępują CI końcowego SHA.

W starszym CI40225052875 macOS Intel, frontend, Rust unit/security i zależności/SBOM już PASS, Windows kontynuuje część natywną. Pośredni run40226261907 zastąpiono końcowym patchem; jego anulowanie nie jest kwalifikacją PASS. Merge i wydanie wymagają końcowych kontroli, w tym **Rust95%, frontend/MCP98%, MAX150**, platform i bezpieczeństwa. Cel100% całej aplikacji pozostaje otwarty.

#137/#138 są poza kandydatem i nadal wymagają pełnego odbioru. TypeScript7 pozostaje peer-blocked przez typescript-eslint; nie wymuszono instalacji. Nie ma nowego main ani opublikowanego0.4.41. Istniejący publiczny422833695 i draft422833723 v0.4.40 zachowano; nowe wydanie ma pochodzić z dokładnego SHA main.

Fixes #210. Fixes #211. Fixes #212. Refs #102, #130, #144, #207, #176.


Odbiór końcowy: CI40227484734 zakończył się8/8PASS dla C164, w tym oba95/98 i obie platformy. PR scalono do release/0.4.9 jako `f41ad56e3ca0a18a4c61e2bcfe945cc4e4c02777`; tree41b959c42c4c74e88d985f32063adeafbc6a71a8 jest identyczne z odebranym kandydatem. Dalsza kwalifikacja main trwa w #176/run40232349630. Brak nowego opublikowanego release.
