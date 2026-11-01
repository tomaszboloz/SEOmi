# YMYL term data and licences (#137)

The YMYL fact gate binds medical and financial values (doses, percentages, amounts) to a named term
(`src/services/llmEconomy/termBinding.ts`). Without a dictionary the gate checks only that a value appears in a
reviewed source.

## Bundled: MeSH seed
- File: `src/services/llmEconomy/meshSeed.ts` (about 60 English descriptor names).
- Source: Medical Subject Headings, U.S. National Library of Medicine. NLM states MeSH is public domain; see
  <https://www.nlm.nih.gov/databases/download/terms_and_conditions.html>.
- Only descriptor names are used, no scope notes or tree data. The seed is a small starter list, not a full vocabulary.
  Users can import the full MeSH descriptor list (also public domain) through Settings.

## Not bundled: ICD-10
- ICD-10 (WHO) and national modifications (for example ICD-10-CM, ICD-10 PL) carry licence terms that do not allow
  redistribution inside SEOmi. SEOmi ships no ICD-10 codes or labels.
- Users who hold a licence, or use an openly licensed list, import it as a text or CSV file (one entry per line,
  `#` starts a comment, comma, semicolon and tab separate cells). The list stays in local storage on the device and is
  never sent to a provider.

## Defaults
- MeSH seed is on by default; it can be switched off.
- The imported list is capped at 20 000 terms and 400 000 characters.
