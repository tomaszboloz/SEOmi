Kontynuacja 0.5.0 — 2026-10-27. Zakres milestones pozostaje: 0.5.0 AI & Trust, następnie 0.6.0.

Na osobnej gałęzi integracyjnej łączymy odebrane lokalnie zmiany AIO (profile/offsety/chunking/SPO/brak danych), UI rewrite i bezpieczny eksport JSON-LD, EETV (piąta warstwa/profil/coverage/historia/alerty) oraz zależność #137 (budżet/cache/YMYL/CMS provenance/privacy). Niezależny audyt znalazł i skierował do poprawy m.in. mieszanie profili historycznych, utratę liczb dziesiętnych oraz przedstawianie cloud CLI jako lokalnego przetwarzania. Te poprawki mają lokalne testy regresji; wspólny odbiór zintegrowanego źródła dopiero trwa. Transport weryfikacji identity/citation oraz zgodność metryk before/after nadal są sprawdzane.

6 rozmów Codex High pracuje nad implementacją i odbiorem; uruchomiono kolejną rundę 8 Gemini High wyłącznie do prostszych testów w osobnym checkoutcie. Po poprzedniej rundzie realne uruchomienie dało 152/168 PASS; pozostałe błędy rozdzielono na błędy authoringu testów i wymagane regresje aplikacji. Sama deklaracja agenta nie jest dowodem PASS.

PR #218 jest scalony. PR #219 nadal ma head `65ec0b98bcd10cb80b02828e552e1a39bb7a74e9`, auto-merge squash i niezmienione strict gates. W CI `40436262683` przeszły frontend, Rust i security/SBOM; platformowe Windows/macOS jeszcze trwały przy odczycie. Publiczne 0.4.43 nie jest jeszcze potwierdzone. Ostatnie potwierdzone wydanie publiczne: 0.4.42.

Nie zamykamy issues 0.5.0 ani nie publikujemy tego numeru na podstawie samych patchy/testów jednostkowych. Rust95%, frontend/MCP98%, MAX150, 12 języków oraz odbiór dokładnego SHA, natywnych paczek, PDF, updatera i provenance pozostają wymagane. Unknown/unavailable nie staje się zerem; źródła i ręczna akceptacja zmian CMS pozostają obowiązkowe.
