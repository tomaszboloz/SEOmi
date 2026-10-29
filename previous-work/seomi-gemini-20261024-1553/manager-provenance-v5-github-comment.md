Aktualizacja odbioru #102: lokalny publisher v5 przeszedł niezależne wykonanie produkcyjnego prepareReleaseProvenance/uploadera na rzeczywistych plikach, z atrapą wyłącznie transportu GitHub.

- Pełne ponowienie tego samego draftu i retry po HTTP503 na trzecim uploadzie przechodzą.
- Mutacje ograniczono do4metadanych: sbom-node.json, sbom-rust.json, SHA256SUMS.txt, release-provenance.json. Instalatory, podpisy i obce assety zachowały ID oraz SHA.
- Brak digestu wymusza świeży download poassetId; cache o tym samym rozmiarze zostaje ponownie związany z bajtami remote. Błędny dostarczony digest kończy ścieżkę przed downloadem/uploadem.
- Obowiązkowe poprawne SBOM Node/Rust, oba DMG i nazwy wynikające z wersji tagu są objęte inventory.

Paczka jest nałożona lokalnie do integratora wraz z migracjąRustlatest i fixturedesktop; końcowa walidacja połączonego kodu trwa. Zmiany jeszcze nie zostały wypchnięte do#209. Nie jest to dowód produkcyjnegoOIDC/attestation ani nowego wydania; issue pozostaje otwarte. Wykonawca dodaje trwałe regresje retry. BramkiRust95/frontend-MCP98/MAX150 pozostają bez zmian.
