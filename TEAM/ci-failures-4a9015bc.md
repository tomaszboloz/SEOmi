# Analiza Awarii Zdalnego CI dla PR #176 (Commit 4a9015bc)

**PR:** #176 (`release/0.4.9` -> `main`)  
**Commit SHA:** `4a9015bc8ed76ee1cef8ef6ec3ec7dacb9700b87`  
**Pobrane źródło:** GitHub Check Runs via `gh api`  
**Data pobrania:** 2026-10-24  

---

## 1. Awaria 1: Rust Production Coverage Measurement
- **Nazwa kontrolki:** `Rust production coverage measurement`
- **Job ID:** `120924277292` (Run ID: `40109165767`)
- **Środowisko wykonawcze:** `macos-15-intel`
- **Lokalizacja w repozytorium:** `.github/workflows/test.yml:148` (lub sekcja joba `coverage-rust`)
- **Pełny log błędu:**
  ```text
  info: syncing channel updates for nightly-x86_64-apple-darwin
  error: could not download file from 'https://static.rust-lang.org/dist/channel-rust-nightly.toml.sha256' to '/Users/runner/.rustup/tmp/6dnqqzu9azoi18d5_file': error downloading file: error sending request for url (https://static.rust-lang.org/dist/channel-rust-nightly.toml.sha256): client error (Connect): dns error: failed to lookup address information: nodename nor servname provided, or not known
  Process completed with exit code 1.
  Failed to CreateArtifact: Unable to make request: ENOTFOUND
  ```
- **Przyczyna źródłowa:**
  Błąd rozwiązania nazwy DNS (`ENOTFOUND` / `dns error: failed to lookup address information`) na maszynie wirtualnej GitHub runnera `macos-15-intel`. Krok wykonuje surowe polecenie shell: `rustup toolchain install nightly --profile minimal --component llvm-tools-preview`. Ze względu na brak mechanizmu retry lub przypięcia narzędzi, chwilowy brak łączności DNS w chmurze GitHub Actions spowodował natychmiastowe przerwanie joba kodem 1.
- **Minimalna propozycja naprawy:**
  W `.github/workflows/test.yml`:
  1. Zastąpienie surowego skryptu instalacji akcją zarządzaną ze wsparciem pobierania i buforowania (np. `dtolnay/rust-toolchain@nightly` z komponentem `llvm-tools-preview`), LUB
  2. Dodanie odpornego na błędy przejściowe mechanizmu pobierania z ponawianiem prób (retry na poziomie rustup lub wrapper bash).

---

## 2. Awaria 2: Zagregowany Check CodeQL
- **Nazwa kontrolki:** `CodeQL`
- **Check Run ID:** `120917189876` (Aplikacja: `github-advanced-security`)
- **Wynik:** `failure` (1 alert High Severity)
- **Reguła bezpieczeństwa:** `js/incomplete-url-substring-sanitization`
- **Lokalizacja w kodzie:** `tests/sprsWhatIfSnapshot.test.tsx:43:29-57`
- **Fragment kodu powodujący błąd:**
  ```typescript
  // tests/sprsWhatIfSnapshot.test.tsx, linie 41-44:
  const rows = screen.getAllByRole('row').slice(1);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.some((row) => row.textContent?.includes(D))).toBe(true);
  expect(edges).toHaveLength(3);
  ```
  gdzie stała `D` to:
  ```typescript
  const D = 'https://a.test/d';
  ```
- **Komunikat CodeQL:**
  `'[https://a.test/d](1)' can be anywhere in the URL, and arbitrary hosts may come before or after it.`
- **Przyczyna źródłowa:**
  Silnik reguł semantycznych CodeQL wykrywa wywołanie `.includes(D)` na stringu `textContent` i kwalifikuje je heurystycznie jako podatność niekompletnej sanityzacji URL (ryzyko SSRF / open redirect / bypass weryfikacji domeny), mimo że kod znajduje się w pliku testu UI.
- **Minimalna propozycja naprawy:**
  W `tests/sprsWhatIfSnapshot.test.tsx` w linii 43 zastąpić heurystyczne `.includes(D)` na całym wierszu precyzyjnym sprawdzeniem elementu DOM:
  ```typescript
  // Opcja A (najprostsza i najbardziej idiomatyczna w RTL):
  expect(screen.getByText(D)).toBeInTheDocument();

  // LUB Opcja B (dokładne sprawdzenie komórki tabeli bez wywołania includes na całym stringu):
  expect(rows.some((row) => row.querySelector('td:nth-child(2)')?.textContent === D)).toBe(true);
  ```
  Zmiana ta eliminuje wzorzec syntaktyczny wyzwalający alert CodeQL, zachowując 100% asercji testowej.
