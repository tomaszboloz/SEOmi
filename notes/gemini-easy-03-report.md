# Gemini Easy Worker 03 Report: CSV & Download Export Safety

## Scope & Ownership
- **Role**: Gemini easy worker 3/6 in SEOmi
- **Owned Files**:
  - `tests/geminiEasy03CsvSafety.test.ts` (119 physical lines)
  - `tests/geminiEasy03DownloadBlob.test.ts` (120 physical lines)
  - `tests/geminiEasy03PdfDownload.test.ts` (131 physical lines)
- **Status**: NOT RUN (as mandated, file-only task; root Codex will execute test suite).

## Coverage & Scenarios

### 1. `tests/geminiEasy03CsvSafety.test.ts`
- **Formula Injection Neutralization (`spreadsheetSafe`)**:
  - Neutralization of standard leading formula triggers (`=`, `+`, `-`, `@`) with prepended apostrophe (`'`).
  - Neutralization of formula triggers preceded by arbitrary whitespace combinations (spaces, tabs `\t`, carriage returns `\r`, newlines `\n`, mixed whitespace).
  - Immunity for legitimate mid-text symbols, math expressions, hyphenated slugs, and email addresses (`user@example.com`, `1+1=2`, `A = B + C`, `formula=`).
  - Handling of non-string primitives (`null`, `undefined`, numbers `0`, `42`, booleans `true`, `false`).
- **Quoting and Cell Escaping Integrity (`escapeCsv`)**:
  - Wrapping of cell contents in double quotes.
  - Doubling of embedded quotes (`"` -> `""`).
  - Combined formula neutralization with quoted cells (`=HYPERLINK(...)`).
  - Preservation of multiline strings (`\n`, `\r\n`) and embedded tabs.
  - Multi-byte Unicode preservation (Polish diacritics, CJK, Emojis, Arabic RTL).
- **Tabular Matrix Formatting (`csv`) & i18n Helpers**:
  - RFC 4180 standard CRLF (`\r\n`) row delimiters and comma column separators.
  - Empty matrices and empty row handling.
  - Internationalized headers (`exportHeaders`) and localization strings (`exportText`).

### 2. `tests/geminiEasy03DownloadBlob.test.ts`
- **DOM Lifecycle & Anchor Operations (`downloadBlob`)**:
  - Object URL creation via `URL.createObjectURL(blob)`.
  - DOM anchor construction with assigned `href`, `download` attributes, and attachment to `document.body`.
  - Programmatic click trigger.
  - Immediate element removal from DOM in `finally` block.
  - Delayed URL revocation via `setTimeout(..., 0)` to allow WebView download stream to initiate without prematurely invalidating the blob URL.
- **Resilience and Leak Prevention**:
  - Guarantees anchor removal and scheduled URL revocation even when `anchor.click()` throws (simulated download permission denial).
  - Clean management of multiple sequential downloads without DOM pollution or resource leaks.
- **Text & MIME Packaging (`downloadText`)**:
  - Packaging text content into a `Blob` with `${mimeType};charset=utf-8`.
  - Preservation of Polish Unicode diacritics and JSON formatting inside the Blob.

### 3. `tests/geminiEasy03PdfDownload.test.ts`
- **Genuine PDF Header Validation (`downloadPdf`)**:
  - Verification of 5-byte magic signature `[0x25, 0x50, 0x44, 0x46, 0x2d]` (`%PDF-`).
  - Base64 decoding verification via `atob`.
  - Successful audit and crawl PDF generation with language metadata decoration (`pdf_locale`, `pdf_labels`).
  - Forwarding valid PDF payload to `downloadBlob` with `application/pdf` MIME type.
- **Rejection & Error Handling**:
  - Rejection of mutated signatures (e.g. `%PDG-`, lowercase `%pdf-`).
  - Rejection of non-PDF responses (HTML documents, JSON errors, ZIP archives, image headers).
  - Rejection of truncated headers (< 5 bytes) and empty strings.
  - Rejection of corrupted non-base64 strings.
  - Rejection of invalid non-string payloads from Tauri IPC transport.
  - Proper propagation of underlying IPC rejection errors.

## Integrity Checklist
- [x] Zero modifications to existing files, packages, lockfiles, workflows, or source files.
- [x] No command execution, subprocesses, network calls, or test runners invoked.
- [x] All 3 files strictly <= 150 physical lines.
- [x] Real functions tested with plain fixtures; mocked only I/O (Tauri transport and browser DOM download triggers).
- [x] No skipped or todo tests.
