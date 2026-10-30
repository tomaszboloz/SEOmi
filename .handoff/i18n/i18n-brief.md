# Translation brief (SEOmi UI locales)

Goal: about 2,500 UI strings per locale in `src/i18n/locales/<locale>.json` are still identical to English. Translate them.
Your locales are given in your prompt. Work locale by locale.

Scripts (scratchpad, do not copy into the repo), S = C:/Users/bm-la/AppData/Local/Temp/claude/C--laragon-www-SEOmi/5facf392-2db5-47bd-b0fc-8af816d51a64/scratchpad
- `node $S/i18n-extract.cjs <repo> <locale> <outDir>`: writes `<locale>-todo-NN.json` chunks of up to 300 keys, `"a > b > c": "English"`.
- `node $S/i18n-apply.cjs <repo> <locale> <done files...>`: writes translated values in place. Key order and formatting are kept. It rejects values whose `{{placeholders}}`, `<tags>` or `$t(...)` differ from English, and prints them; fix and re-apply.

Steps
1. In your worktree: `git fetch upstream` then `git checkout -b i18n/<your-locales> upstream/integrate/0.7.0`. If `node_modules` is missing, create a junction: `cmd //c mklink /J node_modules C:\\laragon\\www\\SEOmi\\node_modules`.
2. Extract into `$S/i18n-<locale>/`. Read each todo chunk and write a `<locale>-done-NN.json` with the same keys (Write tool). Translate every value.
   - Keep these in English: product and module acronyms (SEO, SERP, TRS, SFS, TAS, HSS, IGOS, SIJA, SPRS, AIO-R, EETV, E-E-A-T, GSC, GA4, PDF, CSV, JSON-LD, URL, API, MCP, Ollama, hreflang), brand names, code identifiers, units and file names.
   - Keep `{{placeholders}}`, HTML-like tags and `$t(...)` exactly. Keep i18next plural/context key suffixes as they are (only values change).
   - Use the terminology the locale file already uses. Before you start, look at 50 or so already-translated keys in the same namespaces and keep their vocabulary.
   - Use natural, concise UI language, the formal register usual for software in that language (de: "Sie"; fr: "vous"; ja: です/ます; ko: 합니다체), and the right script and direction (ar is RTL; do not add direction marks).
   - A value that is correctly identical in the target language (e.g. "URL", "Ollama") may stay as is.
3. Apply all done files, then run `npx vitest run tests/i18n.test.ts` plus any test matching `*ocale*` or `*i18n*` in `tests/`. Fix failures. Some tests assert English text rendered under another locale? If a test fails because it expected the old English value in a non-English locale, update that test's expectation, not the translation.
4. Commit per locale: `i18n(<locale>): translate remaining UI strings (#109)` with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push with `git push upstream i18n/<your-locales>`. Do not open a PR. Do not touch other files except tests from step 3.
5. Final report (under 15 lines): branch, head SHA, per locale the number translated, the number kept identical on purpose and the number rejected, and the tests run.

Do not add a "native review done" claim anywhere; this is a machine translation and #109 native review stays separate.
