# Gemini Easy Worker 2/6 — i18n & Contextual Help Report

## Overview
- **Worker Role**: Gemini easy worker 2/6 in SEOmi
- **Task Scope**: i18n and contextual help regressions checking actual task/causal labels and HelpTips resolve in all 12 locales (`en`, `pl`, `es`, `de`, `fr`, `it`, `pt`, `ru`, `ja`, `zh`, `ko`, `ar`).
- **Production Changes**: ZERO (Production files, packages, workflows, and gates strictly unmodified).
- **Execution Status**: **NOT RUN** (Tests created via native file tools only; execution deferred to root Codex).

---

## Delivered Test Files
All files follow the assigned disjoint prefix `tests/geminiEasy02*` and strictly observe the line limit (<= 150 physical lines):

1. [`tests/geminiEasy02TaskLabels.test.ts`](file:///Users/tomaszboloz/.codex/worktrees/gemini-easy-next/seomi/tests/geminiEasy02TaskLabels.test.ts) (85 lines)
   - **Scenarios**:
     - Resolves all 5 task kinds (`add-link`, `redirect-301`, `remove-410`, `add-entities`, `remove-noindex`) without raw key leakage across all 12 locales.
     - Resolves all 4 task lifecycle statuses (`planned`, `implemented`, `verified`, `failed`), 3 priority levels (`high`, `medium`, `low`), and 3 filters (`all`, `mine`, `overdue`) across all 12 locales.
     - Resolves all 13 optimization tasks UI labels (`aria`, `title`, `add`, `added`, `empty`, `verify`, `markImplemented`, `regression`, `owner`, `priority`, `dueDate`, `overdue`, `me`) across all 12 locales.
     - Resolves all 11 task verification verdicts with valid plain input interpolations (`link-found`, `link-missing`, `redirect-ok`, `redirect-wrong-target`, `still-200`, `gone-ok`, `wrong-status`, `entities-ok`, `entities-missing`, `index-ok`, `still-noindex`) across all 12 locales without unreplaced placeholders.

2. [`tests/geminiEasy02CausalLabels.test.ts`](file:///Users/tomaszboloz/.codex/worktrees/gemini-easy-next/seomi/tests/geminiEasy02CausalLabels.test.ts) (85 lines)
   - **Scenarios**:
     - Resolves all 4 causal verdicts (`positive`, `negative`, `noEffect`, `inconclusive`) across all 12 locales without key leakage.
     - Resolves causal reason metadata, constraints, and disclaimers (`title`, `empty`, `updateWindow`, `normalized`, `unknown`, `marketUnavailable`, `controlUnavailable`, `updateWindowReason`, `disclaimer`) across all 12 locales.
     - Interpolates causal effect estimates with plain inputs (`effect`, `lower`, `upper`) in all 12 locales without residual placeholder tokens.
     - Interpolates causal evidence descriptors with plain inputs (`market`, `control`) in all 12 locales without residual placeholder tokens.
     - Tests dynamic runtime language switching across all 12 locales to verify active translation context resolution.

3. [`tests/geminiEasy02HelpTips.test.tsx`](file:///Users/tomaszboloz/.codex/worktrees/gemini-easy-next/seomi/tests/geminiEasy02HelpTips.test.tsx) (84 lines)
   - **Scenarios**:
     - Complete HelpTip registry check: verifies every single registered `HelpId` in `en.help` possesses non-empty string fields for `title`, `what`, `why`, and `action` in all 12 locales, ensuring the `useHelp` contract never returns `null`.
     - Validates `helpUi` structural labels (`what`, `why`, `action`, `example`, `learnMore`) across all 12 locales.
     - Interactive component tests rendering `<HelpTip id="executionCard.tasks" />` and `<HelpTip id="causalMarket.updateWindow" />` in `en`, `pl`, `de`, `ar` (RTL) and `ja`:
       - Checks button accessibility attributes (`aria-label`, `data-help-id`, `aria-expanded`).
       - Fires click event to verify popover tooltip (`role="tooltip"`) renders with localized content.
       - Asserts `dir="rtl"` on Arabic popover and `dir="ltr"` on LTR locales.

---

## Audit of Actual Untranslated Keys Found in Locales
Per task instructions, inspecting `src/i18n/locales/*.json` revealed that while `executionCard.tasks` and `causalMarket` are completely translated in all 12 languages, several older HelpTip entries in the `help` registry remain untranslated (retaining verbatim English source text) in 10 locales:

- **Affected Locales (10)**: `ar`, `de`, `es`, `fr`, `it`, `ja`, `ko`, `pt`, `ru`, `zh` (translated in `en` and `pl` only).
- **Exact Untranslated Keys**:
  - `help.overview.healthScore` (`title`, `what`, `why`, `action`, `example`, `learnMore`)
  - `help.overview.httpStatus` (`title`, `what`, `why`, `action`, `example`)
  - `help.overview.responseTime` (`title`, `what`, `why`, `action`, `example`)
  - `help.overview.severityCounts` (`title`, `what`, `why`, `action`, `example`)
  - `help.overview.wordCount` (`title`, `what`, `why`, `action`, `example`)
  - `help.metadata.titleLength` (`title`, `what`, `why`, `action`, `example`)
  - `help.metadata.metaDescription` (`title`, `what`, `why`, `action`, `example`)
  - `help.headings.h1Count` (`title`, `what`, `why`, `action`, `example`)
  - `help.images.overview` (`title`, `what`, `why`, `action`, `example`)
  - `help.links.overview` (`title`, `what`, `why`, `action`, `example`)
  - `help.settings.theme` (`title`, `what`, `why`, `action`, `example`)
  - `help.settings.auditNotifications` (`title`, `what`, `why`, `action`, `example`)

No production files were modified, respecting the strict freeze rule.
