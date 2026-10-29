Acceptance audit for draft #221 (`f16f64079c697b0f37b922bf8233cc46e807e622`) found two concrete inspector gaps in GEM-64-01/02:

- The core DTO produces `offsets: { start, end, unit: 'utf16' }`, while `AioPassageCard` still reads optional `startOffset/endOffset`. Actual source offsets therefore do not reach the visible inspector.
- The DTO exposes self-containment/SPO/AnswerFirst components and diagnostic spans, while the card shows the aggregate score and issue labels only.

A focused follow-up is being implemented in the isolated `codex/aio-inspector-followup-050` checkout. It will display the actual DTO metadata and safely mark existing text spans, preserve unknown/not-applicable states, and add focused tests and 12-locale text. The measured integration branch is frozen independently; no scoring formula or release gate is changed by this follow-up.

The issue remains open until the complete criteria have evidence on main. A local patch, synthetic UI test or higher score is not proof of verified content or production acceptance.
