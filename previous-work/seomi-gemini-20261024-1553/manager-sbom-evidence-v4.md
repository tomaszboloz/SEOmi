# Raport dowodowy #102: Autentyczny artefakt SBOM i kontrakt Provenance (v4)

> [!NOTE]
> **Zastrzeżenie:** To badanie jest analizą techniczną autentycznych artefaktów CI oraz oficjalnego kontraktu GitHub Actions. To nie jest produkcyjna atestacja OIDC ani dowód całego wydania.

## 1. Autentyczny artefakt CI: `dependency-sbom-40181378997`

- **Repozytorium:** `tomaszboloz/SEOmi`
- **Workflow Run:** `40181378997` (commit `ec44974140a8f26ada613ec7fb0aae92d5b32397`)
- **Job ID:** `121132985065` (`Dependency Vulnerability Scan & SBOM` — wynik: `success`)
- **Artifact ID:** `12594600332` (`dependency-sbom-40181378997`)
- **Rozmiar archiwum zip:** 145 829 B (SHA256: `4a207aac44f87881000f01b9fac75d6d2854d79ea8ddae356b25a0c7db02f43a`)

### Struktura plików wewnątrz pobranego artefaktu:

| Plik w artefakcie | Narzędzie | bomFormat | specVersion | Liczba komponentów | Rozmiar | SHA256 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sbom-node.json` | `@cyclonedx/cyclonedx-npm@6.0.1` | `CycloneDX` | `1.6` | **247** | 552 245 B | `800b1cd86531c8bc0ba6b75f2c3e8c029e7a32c793e5c58eae831e2b245d48a2` |
| `src-tauri/sbom-rust.json` | `cargo-cyclonedx@0.5.9` | `CycloneDX` | `1.3` | **598** | 756 453 B | `3a9acba562f755b2b72c38c45cbf9ae5b5fedece73550ed9aefdbf8322f0b0c7` |

---

## 2. Rozstrzygnięcie kwestii wyjścia `cargo-cyclonedx@0.5.9`

1. **Faktyczna nazwa i ścieżka pliku:**
   - Polecenie wykonane w CI: `cargo cyclonedx --manifest-path src-tauri/Cargo.toml --format json --target all --override-filename sbom-rust`.
   - **Rzeczywisty plik wyjściowy:** `src-tauri/sbom-rust.json` (w podkatalogu manifestu `src-tauri/`, a NIE w roocie; rozszerzenie to `.json`, a NIE `.cdx.json`).
   - W `scripts/release-ci-gate-provenance.mjs` linia 134 poprawnie przewidziano tę regułę:
     `const rustPath = existsSync(`${artifactDir}/sbom-rust.json`) ? `${artifactDir}/sbom-rust.json` : `${artifactDir}/src-tauri/sbom-rust.json`;`

2. **Generowanie metadanych wieloplatformowych na Ubuntu:**
   - Runner CI: `ubuntu-latest` (Linux x86_64).
   - Opcja `--target all` w `cargo-cyclonedx` analizuje graf metadanych `cargo metadata` (wszystkie gałęzie targetowe w `Cargo.lock`), nie wymagając kompilatora C ani nagłówków macOS (`objc2`, `block2`, `AppKit`).
   - W kroku CI wygenerowano pełny SBOM obejmujący 598 komponentów w 2.8 sekundy bez błędów kompilacji.

---

## 3. Kontrakt na żywo: `actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8`

Pobrany i zbadany oficjalny kod z `actions/attest@508db95dd578ae2727ebd6217d5ba78e4fbda05d` (podstawa composite action):

1. **Wymagane uprawnienia (Permissions):**
   - `id-token: write` — wymagane do pozyskania tokenu OIDC do wymiany na certyfikat w Fulcio / Sigstore.
   - `attestations: write` — wymagane do zapisu atestacji w GitHub Attestations API.
   - `contents: read` (lub `contents: write` w jobie publikującym wydanie).

2. **Format i specyfikacja `subject-checksums`:**
   - Parser: funkcja `getSubjectFromChecksumsString` dzieli linie separatorem spacji (`record.indexOf(' ')`).
   - Akceptowany format linii: `<hex_digest>  <artifact_name>` lub `<hex_digest> *<artifact_name>` (standard `sha256sum`).
   - Algorytm: automatycznie dedukowany z długości hasha (64 znaki = `sha256`, 128 znaków = `sha512`).
   - Ograniczenia: maksymalnie 1024 podmioty (subjects), maksymalny rozmiar pliku sum: 512 KB.
   - Usuwanie prefiksu binarnego: wiodąca gwiazdka `*` lub spacja przed nazwą pliku jest automatycznie odcinana.

---

## 4. Weryfikacja integralności surowych logów

- **Pobrany surowy log joba:** `/tmp/seomi-gemini-20261024-1553/ci-40181378997-job-121132985065.raw.log` (SHA256: `9f593f79f93b853f5250818c40bab585879c4aa37d7de39ec7596126672030a1`)
- **Pobrany katalog artefaktów:** `/tmp/seomi-gemini-20261024-1553/ci-ec44974-dependency-sbom`
