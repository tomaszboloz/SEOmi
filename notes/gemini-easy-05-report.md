# Gemini Easy Worker 05 Report: altCheck Regression Tests

## Summary
- **Target Component:** `src/services/multimodal/altCheck.ts` and related types (`AltInput`, `AltVerdict`, `AltIssue`).
- **Files Created:**
  - `tests/geminiEasy05AltBasic.test.ts` (117 lines <= 150 physical lines limit)
  - `tests/geminiEasy05AltKeywordsUnicode.test.ts` (113 lines <= 150 physical lines limit)
- **Status:** **NOT RUN** (per strict rule: native file tools only, test execution deferred to root Codex).

## Covered Behaviors and Scenarios

### 1. `tests/geminiEasy05AltBasic.test.ts`
- **Absent Alt:**
  - Verifies that `alt: undefined` returns `{ role: 'unknown', issues: ['missing'], contextOverlap: null }`.
  - Ensures presence of `caption` and `context` does not trigger additional issue evaluation when `alt` is absent.
- **Empty & Decorative Alt:**
  - Verifies explicit `alt: ''` resolves to `{ role: 'decorative', issues: [], contextOverlap: null }`.
  - Verifies whitespace-only alt text (`'\t\n   \r\n'`) resolves to decorative role with zero issues.
- **Descriptive Text & Lexical Overlap:**
  - Verifies partial lexical overlap calculation (`contextOverlap`) between alt tokens and context tokens (e.g. 1 matching token out of 3 tokens yields ratio ~0.33333).
  - Verifies `contextOverlap` returns `null` (and does not trigger `unrelated-to-context`) when either `context` or `alt` has no tokens of length >= 3.
  - Verifies that zero overlap (`contextOverlap: 0`) between token sets triggers `unrelated-to-context`.
- **Length Boundaries:**
  - Exact boundary check at `MAX_ALT` (125 characters): trimmed alt text of length 125 does not trigger `too-long`.
  - Alt text of 126 characters triggers `too-long`.
  - Outer whitespace trimming is respected before length measurement.
- **Caption Repeat Variations:**
  - Case-insensitive caption matching with outer whitespace triggers `repeats-caption`.
  - Distinct caption or whitespace-only caption does not trigger `repeats-caption`.

### 2. `tests/geminiEasy05AltKeywordsUnicode.test.ts`
- **Suspicious Filenames & Extensions:**
  - Prefix patterns (`dsc_0042`, `DSC-1099`, `img-9876`, `screenshot-20261026`, `photo 77`) trigger `filename`.
  - Extensions (`.avif`, `.svg`, `.webp`, `.bmp`, `.tiff`, `.gif`) trigger `filename`.
  - Basename matching from `src` URL path (including query parameters and hashes like `?w=800&q=75` or `#top`) triggers `filename`.
  - Negative test: natural descriptive sentences beginning with words like "Screenshot of..." or "Photo of..." do NOT trigger `filename`.
- **Multilingual Generic Keywords:**
  - Generic term detection across English, Polish (`obraz`, `zdjęcie`), German (`bild`, `foto`), Spanish/Portuguese (`imagen`, `imagem`), Italian (`immagine`), and Cyrillic (`изображение`, `фото`) in both lower and upper case.
  - Negative test: descriptive phrases containing generic words (e.g., "Zdjęcie rentgenowskie...") are recognized as descriptive and do not trigger `generic`.
- **Unicode Tokenization & Complex Scenarios:**
  - Full Unicode letter/number token extraction (`[\p{L}\p{N}]{3,}`) with Polish diacritics (`żółta łódź podwodna`) and Cyrillic script (`красный трактор`).
  - Concurrent multi-issue accumulation: alt triggering `generic`, `repeats-caption`, and `unrelated-to-context` simultaneously.
  - Concurrent multi-issue accumulation: alt triggering both `filename` and `too-long` simultaneously.
