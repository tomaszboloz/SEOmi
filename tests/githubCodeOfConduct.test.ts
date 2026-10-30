import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const text = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const advisories = 'https://github.com/tomaszboloz/SEOmi/security/advisories/new';
const conduct = text('CODE_OF_CONDUCT.md');

describe('Code of Conduct (#101)', () => {
  it('is the Contributor Covenant 2.1 with its attribution', () => {
    expect(conduct).toMatch(/^# Contributor Covenant Code of Conduct\n/);
    expect(conduct).toContain('version 2.1');
    expect(conduct).toContain('https://www.contributor-covenant.org/version/2/1/code_of_conduct.html');
    for (const heading of ['Our Pledge', 'Our Standards', 'Enforcement Responsibilities', 'Scope', 'Enforcement',
      'Enforcement Guidelines', 'Attribution']) {
      expect(conduct).toContain(`\n## ${heading}\n`);
    }
    for (const step of ['1. Correction', '2. Warning', '3. Temporary Ban', '4. Permanent Ban']) {
      expect(conduct).toContain(`\n### ${step}\n`);
    }
  });

  it('uses the private contact already published in SECURITY.md and invents no other', () => {
    expect(text('SECURITY.md')).toContain(advisories);
    expect(conduct).toContain(`(${advisories})`);
    expect(conduct).not.toContain('[INSERT CONTACT METHOD]');
    expect(conduct).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });

  it('records the default decision and is linked from CONTRIBUTING', () => {
    expect(conduct).toContain('Decision (default chosen by agent, issue #101)');
    const guide = text('CONTRIBUTING.md');
    expect(guide).toContain('[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)');
    expect(guide).not.toContain('Not yet published');
  });
});
