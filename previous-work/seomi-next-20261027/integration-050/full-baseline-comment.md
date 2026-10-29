Full local baseline for `d4a2bad34ede8b4776f380d2ef08b006a9b08822` completed:

- Frontend: **11,708 PASS / 29 FAIL**, 1,431 files. This is not a passing coverage measurement.
- Native Rust: **2,459 PASS / 1 FAIL**. The failure is MCP discovery against the incomplete local MCP build after dependencies were missing.
- Clippy: PASS.
- The earlier 48-file/391-test result remains targeted evidence only.

The full run exposed missing locale conflict labels/hardcoded text, an unregistered logging allowlist entry, and legacy fixtures/contracts that need the new AIO profile, five Trust layers and reviewed CMS provenance. Owners are fixing those cases while retaining strict gates and negative assertions. Independent review also found citation tri-state and registry/history provenance issues; those fixes are isolated for validation before import.

Local MCP dependencies have now been installed from the existing lock. The draft remains unready for merge or release; results will be replaced with evidence for the next measured SHA, rather than relabeling this failed baseline as green.
