# Outreach Co-Pilot (#143) — codex4

Worktree: /Users/tomaszboloz/.codex/worktrees/outreach-next/seomi
Base: origin/main (v0.4.42), no commit/push/release performed.

Implemented:

- real project-scoped IGOS producer in the default backlink route;
- target evidence comes only from the active project's retained crawl pages;
- first three common-backlink competitor domains are fetched through the existing native inspect_url provider;
- local embeddings and IGOS report are built from fetched competitor text; any missing/failed source stays unavailable;
- mounted draft action per backlink-gap target with IGOS score, novel entities, evidence URL, localized template values, and explicit provider/model/approximation/timestamp provenance;
- deferred result/project-isolation behavior; mismatched project IDs never expose evidence or drafts;
- manual-only workflow: read-only draft text and no send action;
- all 12 locale bundles updated with translated draft, evidence, provenance, unavailable, and local-approximation labels; changed source files stay under 150 lines.

Verification:

- targeted Vitest through shared locked-validation: 25 passed across four files;
- TypeScript no-emit after final code: passed;
- shared-locked ESLint: passed; npm run check:loc: passed; 4332 files, 0 LOC violations;
- git diff --check: passed;
- SHA256SUMS verified for all changed source, test and locale files.

Evidence boundary:

Production IGOS remains unavailable unless the active project has a retained crawl with real excerpts and all three live competitor roots return usable bodies. Evidence timestamps come from the fetched source record; the local-hash provider/model and local lexical approximation are disclosed in the UI. No source, score, provider, timestamp, or recipient data is fabricated.
