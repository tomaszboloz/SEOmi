# ADR 0005: EETV and AIO-R decision defaults

Status: Accepted (owner delegation 2026-11-01). Issues #63 #64 #65 #66 #87 #88 #94 #108 #109 #127. Register: #83.

## Decisions
- GEM-63-D01: passage length unit is words (language-neutral, no tokenizer download). Token counts are an estimate only.
- GEM-63-D02: Extractability stays 0..1 per chunk; domain aggregate is the mean of chunk ChunkScores.
- GEM-65-D01/D02, GEM-87-D01, GEM-88-D01: claim-backed-v1 profile stays the default (EETV = .25 schema + .20 sameAs + .25 author + .20 citation + .10 transparency; missing layers are renormalised, never scored high). Reviewer applies only to medical pages.
- GEM-87-02: sameAs tiers 1/2/3 weigh .45/.25/.08. Host category is a declaration signal, never proof of identity or qualification.
- GEM-88-D02: entailment is a local heuristic (`citationEvidence/entailment.ts`) with an optional Ollama judge behind `EntailmentDeps`. Output is association evidence labelled by method. It never sets `supportsClaim` or `sourceChecked`.
- GEM-94: advisory by default, enforced per project (opt-in). Donor window .60-.85, TRS >= 70.
- #108 thresholds: defaults stay; `sweepAioThresholds()` recommends a change only with >= 20 labels and both classes. Re-calibrate by exporting before/after CSV from production crawls and loading it in the labelling panel.
- Non-PL/EN locale strings are machine-written and accepted; `scripts/locale-review.mts` regenerates checklists for any later native review.

## Re-calibration
Thresholds and weights live in code constants (`ENTAILMENT_THRESHOLDS`, AIO profile). Change the constant and the fixture table in the matching test together.
