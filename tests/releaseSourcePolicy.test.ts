import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertIndependentReleaseFiles, isForbiddenReleasePath } from '../scripts/release-source-policy.mjs';

describe('release input policy', () => {
  it.each([
    'AGENTS.md', 'docs/CLAUDE.md', 'GEMINI.txt', '.github/copilot-instructions.md',
    'docs/PRD-auth.md', 'docs/GAP_REGISTER.md', 'MATRIX.md', 'PARITY_MATRIX.md',
    'AI_NOTES.md', 'AI_CONTEXT.yaml', 'AI_PLAN.json', 'docs/agents.mdx', 'docs/AGENTS.rst',
    'docs/Claude-local.adoc', 'docs/PRD.markdown', 'GAP.md', 'docs/COPILOT.yml',
    '.agents/config.json', '.claude/settings.json', '.gemini/config.json', '.codex/config.toml',
    'docs/AGENTS/instructions', 'docs/AI_PLAN/notes', 'docs/PRD', 'docs\\CLAUDE.md',
  ])('rejects agent/planning input %s', (file) => {
    expect(isForbiddenReleasePath(file)).toBe(true);
    expect(() => assertIndependentReleaseFiles([file])).toThrow('must not be tracked');
  });

  it.each([
    'src-tauri/src/commands/external_link_checker/gap_tests.rs',
    'src-tauri/src/commands/site_crawler/orchestration/tests/gap_boundaries.rs',
    'src-tauri/src/commands/site_crawler/tests/gap_parsers_1.rs',
    'src-tauri/src/commands/site_crawler/tests/gap_pure.rs',
    'src-tauri/src/services/html_parser/tests/gap_favicon.rs',
    'src-tauri/src/services/html_parser/tests/gap_remaining.rs',
    'src-tauri/src/services/schema_validator/tests/gap_remaining.rs',
    'src-tauri/src/services/seo_analyzer/gap_contracts.rs',
    'src-tauri/src/services/seo_analyzer/gap_remaining_tests.rs',
    'src-tauri/src/services/seo_analyzer/gap_tests.rs',
    'src/components/Domain/crawlResults/authority/GapBriefPanel.tsx',
    'src/components/Domain/crawlResults/logIntelligence/matrixView.ts',
    'src/components/Results/copilotPatcher/CopilotPatcherPanel.tsx',
    'src/services/ai/claude.ts', 'src/services/logIntelligence/matrix.ts',
    'src/services/outreachCopilot/gap.ts', 'src/services/siteFocus/gaps.ts',
    'src/stores/tools/backlinks/gap.ts', 'tests/claudeClient.test.ts',
    'tests/copilotPatcher.test.ts', 'tests/copilotPatcherUi.test.tsx',
    'tests/copilotPatcherUiOwnership.test.tsx', 'docs/TEST_ACCEPTANCE_MATRIX.md',
  ])('allows product code or existing non-planning document %s', (file) => {
    expect(isForbiddenReleasePath(file)).toBe(false);
    expect(() => assertIndependentReleaseFiles([file])).not.toThrow();
  });

  it('reports forbidden inputs among ordinary product files', () => {
    expect(() => assertIndependentReleaseFiles(['src/services/ai/claude.ts', 'AGENTS.md', 'docs/GAP_REGISTER.md']))
      .toThrow('AGENTS.md\ndocs/GAP_REGISTER.md');
  });

  it('verifies real tracked paths and fails closed when Git enumeration fails', () => {
    const script = resolve('scripts/release-source-policy.mjs');
    const valid = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    expect(valid.status).toBe(0);
    expect(valid.stdout).toContain('tracked release input paths');
    const failed = spawnSync(process.execPath, [script], {
      encoding: 'utf8', env: { ...process.env, GIT_DIR: resolve('nonexistent-policy-test-git-dir') },
    });
    expect(failed.status).not.toBe(0);
    expect(failed.stdout).not.toContain('Verified');
  });

  it('enforces the same policy in test and release workflows and retains branding checks', () => {
    for (const path of ['.github/workflows/test.yml', '.github/workflows/release.yml']) {
      const workflow = readFileSync(path, 'utf8');
      expect(workflow).toContain('node scripts/release-source-policy.mjs');
      expect(workflow).toContain("if rg -n -i '\\bopen[ -]?seo\\b|every-app|openseo\\.so'");
      expect(workflow).toContain("echo 'Forbidden source branding/reference found in product files.'");
    }
  });
});
