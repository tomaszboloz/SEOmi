# AIO-R #63 / #108 local acceptance matrix

| AC | Local status | Evidence / boundary |
|---|---|---|
| 250/180/30 sentence chunking | PASS | `chunkSectionsAioR`, bounded sentence fallback, UTF-16 offsets |
| Oversized single sentence | PASS | word/token bounded parts, `oversizedSentence`, stable source offsets |
| First-two-sentence pronoun/deictic checks | PASS | antecedent-aware self-containment spans/reasons |
| Core/Pillar anchor | PARTIAL/HONEST | explicit anchor known; missing anchor exposed as unknown, never zero quality |
| AnswerFirst 40-60 window | PASS | clamp and later-window `not-applicable` DTO |
| SPO subject/predicate/object, negation, Q | PASS | lexical heuristic explicitly labeled; no dependency-model claim |
| Table/list extractability normalization | PASS | structural evidence and `<35` words/item rule recorded |
| ChunkScore/AIO-R formulas | PASS | versioned `aio-r-2026-10-26` profile and separate legacy AEO profile |
| PL/EN/full + other language states | PASS/PARTIAL | EN/PL full, ten known uncertain, unknown unsupported with numeric partial signals |
| History/profile migration | PARTIAL/HONEST | profile identity persisted for new crawls; legacy records retained and missing profile blocks monitoring |
| Legacy trend/PDF compatibility | PASS/PARTIAL | hook filters incompatible history; PDF exposes `profile_status` (`persisted`, `legacy-unversioned`, `mismatch`) |
| Comparable completed-crawl alert | PASS | runtime persists `aio_profile`; guard rejects incomplete, unavailable, missing/mismatched profile |
| Unknown/no sections/no score alert behavior | PASS | no delivery, no history write, no frequency consumption |
| Threshold calibration | PASS as harness only | deterministic synthetic labeled cases; no real-world calibration claim |
| Real monitoring comparability | PARTIAL/HONEST | local stored-run wiring tested; production monitoring remains unverified |
| Google AI Overview/GSC citation proof | NOT CLAIMED | readiness is not observation of Google serving/citations |
| 12-locale UI/PDF completion | OUTSIDE CORE | DTO/PDF fields supplied; UI owner must present migration/unknown disclosures |
| CI/native/release/signed artifact | RELEASE-ONLY | not run or claimed in this worktree |
