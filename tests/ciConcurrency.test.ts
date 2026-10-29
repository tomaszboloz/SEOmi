import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/test.yml', 'utf8').replace(/\r\n/g, '\n');
const block = workflow.split('\nconcurrency:\n')[1]?.split('\n\n')[0] ?? '';

describe('test workflow concurrency', () => {
  it('declares one top-level concurrency block before the jobs', () => {
    expect(workflow.indexOf('\nconcurrency:\n')).toBeGreaterThan(0);
    expect(workflow.indexOf('\nconcurrency:\n')).toBeLessThan(workflow.indexOf('\njobs:\n'));
  });

  it('cancels superseded runs of the same pull request only', () => {
    expect(block).toContain("format('pr-{0}', github.event.pull_request.number)");
    expect(block).toMatch(/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  });

  it('never cancels or replaces push runs that release-after-ci depends on', () => {
    expect(block).toContain("format('run-{0}', github.run_id)");
    expect(block).not.toMatch(/cancel-in-progress: true/);
  });
});
