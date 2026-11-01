import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const doc = readFileSync('.github/OWNER_STEPS.md', 'utf8');
const steps = doc.split('\n## ').slice(1);

describe('owner-only steps are tracked in the repo (#100, #101, #102)', () => {
  it('lists S1 to S8 in order', () => {
    expect(steps.map((step) => step.split(' ')[0])).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);
  });

  it('every step has an action and a read-back line', () => {
    for (const step of steps) {
      expect(step, step.slice(0, 20)).toContain('- Do:');
      expect(step, step.slice(0, 20)).toContain('Read back');
    }
  });

  it('never tells anyone to use a placeholder repository name by accident', () => {
    expect(doc).toContain('tomaszboloz/SEOmi');
    expect(doc.match(/OWNER\/REPO/g)?.length).toBeGreaterThan(5);
  });

  it('is referenced from the governance register', () => {
    expect(readFileSync('docs/GOVERNANCE.md', 'utf8')).toContain('.github/OWNER_STEPS.md');
  });
});
