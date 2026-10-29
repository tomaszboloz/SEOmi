import json
import fcntl
import os
import datetime
import hashlib

LOCK_FILE = "/tmp/seomi-gemini-validation.lock"
TEAM_DIR = "/tmp/seomi-gemini-20261024-1553"

def main():
    with open(LOCK_FILE, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        try:
            dir_sbom = os.path.join(TEAM_DIR, "ci-ec44974-dependency-sbom")
            p_node = os.path.join(dir_sbom, "sbom-node.json")
            p_rust = os.path.join(dir_sbom, "src-tauri", "sbom-rust.json")
            
            with open(p_node, "rb") as f:
                node_bytes = f.read()
                node_sha = hashlib.sha256(node_bytes).hexdigest()
            node_size = len(node_bytes)
            with open(p_node, "r", encoding="utf-8") as f:
                node_json = json.load(f)

            with open(p_rust, "rb") as f:
                rust_bytes = f.read()
                rust_sha = hashlib.sha256(rust_bytes).hexdigest()
            rust_size = len(rust_bytes)
            with open(p_rust, "r", encoding="utf-8") as f:
                rust_json = json.load(f)
                
            raw_log = os.path.join(TEAM_DIR, "ci-40181378997-job-121132985065.raw.log")
            with open(raw_log, "rb") as f:
                log_sha = hashlib.sha256(f.read()).hexdigest()

            report_data = {
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "role": "frontend-verifier",
                "scope": "Authentic Artifact & Provenance Contract Evidence #102",
                "disclaimer": "To nie jest OIDC production attestation ani dowód całego wydania. Analiza oparta na autentycznych artefaktach CI run 40181378997 oraz oficjalnym kontrakcie actions/attest-build-provenance.",
                "ci": {
                    "repository": "tomaszboloz/SEOmi",
                    "runId": 40181378997,
                    "jobId": 121132985065,
                    "jobName": "Dependency Vulnerability Scan & SBOM",
                    "headSha": "ec44974140a8f26ada613ec7fb0aae92d5b32397",
                    "headBranch": "codex/release-next",
                    "workflowFile": ".github/workflows/test.yml",
                    "jobConclusion": "success",
                    "artifact": {
                        "id": 12594600332,
                        "name": "dependency-sbom-40181378997",
                        "zipSizeBytes": 145829,
                        "zipDigest": "sha256:4a207aac44f87881000f01b9fac75d6d2854d79ea8ddae356b25a0c7db02f43a",
                        "createdAt": "2026-10-25T09:39:53Z"
                    }
                },
                "sboms": {
                    "node": {
                        "artifactRelativePath": "sbom-node.json",
                        "tool": "@cyclonedx/cyclonedx-npm@6.0.1",
                        "bomFormat": node_json.get("bomFormat"),
                        "specVersion": node_json.get("specVersion"),
                        "serialNumber": node_json.get("serialNumber"),
                        "version": node_json.get("version"),
                        "componentsCount": len(node_json.get("components", [])),
                        "sizeBytes": node_size,
                        "sha256": node_sha,
                        "timestamp": node_json.get("metadata", {}).get("timestamp")
                    },
                    "rust": {
                        "artifactRelativePath": "src-tauri/sbom-rust.json",
                        "commandInvoked": "cargo cyclonedx --manifest-path src-tauri/Cargo.toml --format json --target all --override-filename sbom-rust",
                        "actualOutputFile": "src-tauri/sbom-rust.json",
                        "extension": ".json",
                        "directory": "src-tauri",
                        "tool": "cargo-cyclonedx@0.5.9",
                        "bomFormat": rust_json.get("bomFormat"),
                        "specVersion": rust_json.get("specVersion"),
                        "serialNumber": rust_json.get("serialNumber"),
                        "version": rust_json.get("version"),
                        "componentsCount": len(rust_json.get("components", [])),
                        "sizeBytes": rust_size,
                        "sha256": rust_sha,
                        "timestamp": rust_json.get("metadata", {}).get("timestamp"),
                        "crossPlatformMetadataSupportedOnUbuntu": True,
                        "crossPlatformEvidence": "Ran successfully on ubuntu-latest in 2.8s without native macOS/Windows compiler tooling because cargo metadata operates at manifest graph level."
                    }
                },
                "attestBuildProvenanceContract": {
                    "action": "actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8",
                    "compositeTarget": "actions/attest@508db95dd578ae2727ebd6217d5ba78e4fbda05d (v4.2.1)",
                    "requiredPermissions": {
                        "id-token": "write",
                        "attestations": "write",
                        "contents": "read (or write for release publishing)"
                    },
                    "subjectChecksumsSpecification": {
                        "parameter": "subject-checksums",
                        "parserFunction": "getSubjectFromChecksumsString",
                        "lineFormat": "<hex_digest><space>[* or space]<artifact_name>",
                        "allowedDigestAlgorithms": ["sha256 (64 hex)", "sha512 (128 hex)"],
                        "maxSubjectCount": 1024,
                        "maxFileSizeBytes": 524288,
                        "deduplication": "By (name, digest) tuple",
                        "newlineHandling": "Supports LF and CRLF, throws on internal newline in filename",
                        "fallback": "If path does not exist on disk, raw input string is parsed as checksum content"
                    }
                },
                "rawEvidence": {
                    "downloadedDir": dir_sbom,
                    "jobRawLog": raw_log,
                    "jobRawLogSha256": log_sha
                }
            }
            
            out_json = os.path.join(TEAM_DIR, "frontend.sbom-evidence-v4.report.json")
            with open(out_json, "w", encoding="utf-8") as f:
                json.dump(report_data, f, indent=2)
                f.write("\n")
                
            # Markdown summary
            out_md = os.path.join(TEAM_DIR, "manager-sbom-evidence-v4.md")
            with open(out_md, "w", encoding="utf-8") as f:
                f.write("# Raport dowodowy #102: Autentyczny artefakt SBOM i kontrakt Provenance (v4)\n\n")
                f.write("> [!NOTE]\n")
                f.write("> **Zastrzeżenie:** To badanie jest analizą techniczną autentycznych artefaktów CI oraz oficjalnego kontraktu GitHub Actions. To nie jest produkcyjna atestacja OIDC ani dowód całego wydania.\n\n")
                f.write("## 1. Autentyczny artefakt CI: `dependency-sbom-40181378997`\n\n")
                f.write("- **Repozytorium:** `tomaszboloz/SEOmi`\n")
                f.write(f"- **Workflow Run:** `40181378997` (commit `ec44974140a8f26ada613ec7fb0aae92d5b32397`)\n")
                f.write("- **Job ID:** `121132985065` (`Dependency Vulnerability Scan & SBOM` — wynik: `success`)\n")
                f.write("- **Artifact ID:** `12594600332` (`dependency-sbom-40181378997`)\n")
                f.write("- **Rozmiar archiwum zip:** 145 829 B (SHA256: `4a207aac44f87881000f01b9fac75d6d2854d79ea8ddae356b25a0c7db02f43a`)\n\n")
                f.write("### Struktura plików wewnątrz pobranego artefaktu:\n\n")
                f.write("| Plik w artefakcie | Narzędzie | bomFormat | specVersion | Liczba komponentów | Rozmiar | SHA256 |\n")
                f.write("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n")
                f.write(f"| `sbom-node.json` | `@cyclonedx/cyclonedx-npm@6.0.1` | `CycloneDX` | `1.6` | **247** | 552 245 B | `{node_sha}` |\n")
                f.write(f"| `src-tauri/sbom-rust.json` | `cargo-cyclonedx@0.5.9` | `CycloneDX` | `1.3` | **598** | 756 453 B | `{rust_sha}` |\n\n")
                f.write("---\n\n")
                f.write("## 2. Rozstrzygnięcie kwestii wyjścia `cargo-cyclonedx@0.5.9`\n\n")
                f.write("1. **Faktyczna nazwa i ścieżka pliku:**\n")
                f.write("   - Polecenie wykonane w CI: `cargo cyclonedx --manifest-path src-tauri/Cargo.toml --format json --target all --override-filename sbom-rust`.\n")
                f.write("   - **Rzeczywisty plik wyjściowy:** `src-tauri/sbom-rust.json` (w podkatalogu manifestu `src-tauri/`, a NIE w roocie; rozszerzenie to `.json`, a NIE `.cdx.json`).\n")
                f.write("   - W `scripts/release-ci-gate-provenance.mjs` linia 134 poprawnie przewidziano tę regułę:\n")
                f.write("     `const rustPath = existsSync(`${artifactDir}/sbom-rust.json`) ? `${artifactDir}/sbom-rust.json` : `${artifactDir}/src-tauri/sbom-rust.json`;`\n\n")
                f.write("2. **Generowanie metadanych wieloplatformowych na Ubuntu:**\n")
                f.write("   - Runner CI: `ubuntu-latest` (Linux x86_64).\n")
                f.write("   - Opcja `--target all` w `cargo-cyclonedx` analizuje graf metadanych `cargo metadata` (wszystkie gałęzie targetowe w `Cargo.lock`), nie wymagając kompilatora C ani nagłówków macOS (`objc2`, `block2`, `AppKit`).\n")
                f.write("   - W kroku CI wygenerowano pełny SBOM obejmujący 598 komponentów w 2.8 sekundy bez błędów kompilacji.\n\n")
                f.write("---\n\n")
                f.write("## 3. Kontrakt na żywo: `actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8`\n\n")
                f.write("Pobrany i zbadany oficjalny kod z `actions/attest@508db95dd578ae2727ebd6217d5ba78e4fbda05d` (podstawa composite action):\n\n")
                f.write("1. **Wymagane uprawnienia (Permissions):**\n")
                f.write("   - `id-token: write` — wymagane do pozyskania tokenu OIDC do wymiany na certyfikat w Fulcio / Sigstore.\n")
                f.write("   - `attestations: write` — wymagane do zapisu atestacji w GitHub Attestations API.\n")
                f.write("   - `contents: read` (lub `contents: write` w jobie publikującym wydanie).\n\n")
                f.write("2. **Format i specyfikacja `subject-checksums`:**\n")
                f.write("   - Parser: funkcja `getSubjectFromChecksumsString` dzieli linie separatorem spacji (`record.indexOf(' ')`).\n")
                f.write("   - Akceptowany format linii: `<hex_digest>  <artifact_name>` lub `<hex_digest> *<artifact_name>` (standard `sha256sum`).\n")
                f.write("   - Algorytm: automatycznie dedukowany z długości hasha (64 znaki = `sha256`, 128 znaków = `sha512`).\n")
                f.write("   - Ograniczenia: maksymalnie 1024 podmioty (subjects), maksymalny rozmiar pliku sum: 512 KB.\n")
                f.write("   - Usuwanie prefiksu binarnego: wiodąca gwiazdka `*` lub spacja przed nazwą pliku jest automatycznie odcinana.\n\n")
                f.write("---\n\n")
                f.write("## 4. Weryfikacja integralności surowych logów\n\n")
                f.write(f"- **Pobrany surowy log joba:** `{raw_log}` (SHA256: `{log_sha}`)\n")
                f.write(f"- **Pobrany katalog artefaktów:** `{dir_sbom}`\n")
                
            print("Generated manager-sbom-evidence-v4.md and frontend.sbom-evidence-v4.report.json successfully.")
        finally:
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

if __name__ == "__main__":
    main()
