# Gemini Easy Worker 4/6 Task Report

**Worker:** Gemini easy worker 4/6 in SEOmi  
**Workspace:** `/Users/tomaszboloz/.codex/worktrees/gemini-easy-next/seomi`  
**Target Helpers:** `src/services/optimizationTasks/edit.ts`, `storage.ts`, `metricHistory.ts`  
**Execution State:** NOT RUN (file-only mode; root Codex will run all test suites)

---

## 1. Created Test Files

1. `tests/geminiEasy04Edit.test.ts` (106 lines, <= 150 lines limit)
2. `tests/geminiEasy04Storage.test.ts` (105 lines, <= 150 lines limit)
3. `tests/geminiEasy04MetricHistory.test.ts` (134 lines, <= 150 lines limit)

---

## 2. Scenarios Covered

### A. Filters and Deadlines (`tests/geminiEasy04Edit.test.ts`)
- **Owner Edits:** Trimming whitespace, capping at 80 characters, and deleting the property on empty/whitespace-only input.
- **Priority Validation:** Updating on valid priorities (`'high'`, `'medium'`, `'low'`) and ignoring invalid priority values.
- **Due Date Validation:** Accepting strict `YYYY-MM-DD` format, ignoring malformed dates, and deleting due date on empty string.
- **Task Immutability:** Leaving non-matching task IDs untouched and preserving unrelated task properties across partial edits.
- **'mine' Filter:** Case-insensitive comparison, trimming whitespace from query input, and returning an empty array when given empty/whitespace query.
- **'overdue' Filter:** Compares task `dueDate` against reference `today` string, including only tasks with status `'planned'` or `'implemented'`. Excludes `'verified'`, `'failed'`, tasks due today, future tasks, or tasks without deadlines.
- **'all' Filter:** Preserves all tasks without modification.

### B. Project Separation & Duplicate Planning (`tests/geminiEasy04Storage.test.ts`)
- **Project Separation:** Verifies distinct storage keys (`seomi_project_${id}_optimization_tasks_v1`) and ensures reads/writes for Project A do not leak into or affect Project B.
- **Duplicate Prevention:**
  - Tasks in open states (`'planned'` or `'implemented'`) matching `kind`, `url`, and `targetUrl` return the existing array without creating duplicates.
  - Resolved tasks (`'verified'` or `'failed'`) permit re-planning of new tasks.
  - Distinguishes tasks with different `targetUrl` or undefined vs defined target URLs.
- **Implementation Status:** `markImplemented` updates planned tasks with timestamp while leaving verified, failed, or non-matching tasks untouched.
- **Failed Persist Integrity:** When `localStorage.setItem` throws (e.g. `QuotaExceededError`), `writeTasks` returns `false` and previously stored tasks remain intact.

### C. Metric History & Real Zero vs Empty History (`tests/geminiEasy04MetricHistory.test.ts`)
- **Empty History vs Real Zero:**
  - Fresh project returns `[]`.
  - Tasks transitioning to `'verified'` with `delta: 0` are appended and stored.
  - `readMetricHistory` returns the entry with `delta: 0` (distinguishing real zero from empty/missing metric data).
  - Malformed storage rows (non-numeric deltas, `null`, `'0'`) are filtered out while real zero (`0`) and negative deltas are preserved.
- **Metric History Project Separation:** Verifies isolated keys (`seomi_project_${id}_metric_history_v1`) ensuring deltas appended in one project do not pollute another.
- **Transition Contract:** Deltas are appended only when a task transitions from prior status `'implemented'` to resolved (`'verified'` or `'failed'`) with a non-null verdict delta.
- **Storage Write Avoidance:** `appendDeltas` avoids calling storage writes when no new rows are generated.
- **Failed Persist Integrity:** When storage throws during `appendDeltas`, existing metric history remains intact and uncorrupted.
