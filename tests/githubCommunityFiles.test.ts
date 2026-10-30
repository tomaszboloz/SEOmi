import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The repo ships no YAML parser, so the forms are read as GitHub's flat
// issue-form layout: one `  - type:` block per field under `body:`.
type FormField = { type: string; id?: string; required: boolean; options: { label: string; required: boolean }[] };
type IssueForm = { labels: string; body: FormField[] };

const text = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

function parseField(block: string): FormField {
  const options = [...block.matchAll(/- label: (.+)\n\s+required: (true|false)/g)].map((m) => ({
    label: m[1],
    required: m[2] === 'true',
  }));
  return {
    type: block.match(/^(\S+)/)?.[1] ?? '',
    id: block.match(/\n {4}id: (\S+)/)?.[1],
    required: /\n {4}validations:\n {6}required: true/.test(block),
    options,
  };
}

function form(name: string): IssueForm {
  const source = text(`.github/ISSUE_TEMPLATE/${name}`);
  const [head, body = ''] = source.split('\nbody:\n');
  return {
    labels: head.match(/\nlabels: (.+)/)?.[1] ?? '',
    body: body.split(/^ {2}- type: /m).slice(1).map((block) => parseField(block)),
  };
}

const requiredIds = (f: IssueForm) => f.body.filter((field) => field.required).map((field) => field.id);
const advisories = 'https://github.com/tomaszboloz/SEOmi/security/advisories/new';

describe('issue forms (#101)', () => {
  it('bug form requires version, environment, reproduction and outcomes', () => {
    const bug = form('bug_report.yml');
    expect(bug.labels).toBe('[bug]');
    expect(requiredIds(bug)).toEqual(
      expect.arrayContaining(['version', 'environment', 'repro', 'expected', 'actual']),
    );
    expect(bug.body.map((field) => field.id)).toEqual(expect.arrayContaining(['evidence', 'scope']));
  });

  it('feature form requires problem, proposal, scope and acceptance criteria', () => {
    const feature = form('feature_request.yml');
    expect(feature.labels).toBe('[enhancement]');
    expect(requiredIds(feature)).toEqual(['problem', 'proposal', 'scope', 'acceptance']);
  });

  it.each(['bug_report.yml', 'feature_request.yml'])('%s gates on secret-free evidence', (name) => {
    const routing = form(name).body.find((field) => field.id === 'routing');
    const options = routing?.options ?? [];
    expect(routing?.type).toBe('checkboxes');
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => option.required)).toBe(true);
    expect(options.some((option) => /tokens/.test(option.label))).toBe(true);
  });

  it('routes vulnerabilities to private advisories and disables blank issues', () => {
    const config = text('.github/ISSUE_TEMPLATE/config.yml');
    expect(config).toMatch(/^blank_issues_enabled: false$/m);
    expect(config).toContain(`url: ${advisories}\n`);
    expect(text('SECURITY.md')).toContain(advisories);
  });
});

describe('pull request template and contributing guide (#101)', () => {
  it('asks for problem, linked issue, paths, exact-SHA tests and risks', () => {
    const template = text('.github/PULL_REQUEST_TEMPLATE.md');
    for (const heading of ['Problem and result', 'Linked issue', 'Changed paths', 'Tests', 'Migrations and risks', 'Release']) {
      expect(template).toContain(`## ${heading}\n`);
    }
    expect(template).toContain('Tested head SHA:');
    expect(template).toContain('does not promise a release');
  });

  it('keeps the quality bars stated in CONTRIBUTING', () => {
    const guide = text('CONTRIBUTING.md');
    expect(guide).toContain('150 physical lines');
    expect(guide).toContain('Rust 95%, frontend and MCP 98%');
    expect(guide).toContain('Security Advisories');
    expect(guide).toContain('read-only');
  });
});

describe('CODEOWNERS (#101)', () => {
  const rules = text('.github/CODEOWNERS')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/));

  it('lists only the repository owner, so no uninvited reviewer is required', () => {
    expect(rules.length).toBeGreaterThan(0);
    for (const [, ...owners] of rules) expect(owners).toEqual(['@tomaszboloz']);
  });

  it('has a catch-all rule and only paths that exist', () => {
    expect(rules[0][0]).toBe('*');
    for (const [pattern] of rules.slice(1)) {
      expect(existsSync(pattern.replace(/^\//, '').replace(/\/$/, '')), pattern).toBe(true);
    }
  });
});
