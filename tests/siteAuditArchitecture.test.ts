import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';

it('separates SiteAudit orchestration and views without persistence in panels', () => {
  const entry = readFileSync('src/components/Domain/SiteAudit.tsx', 'utf8');
  expect(entry).toContain('useSiteAuditSession');
  expect(entry.split('\n').length).toBeLessThan(300);
  const directory = 'src/components/Domain/siteAudit';
  const files = readdirSync(directory).filter(file => /\.tsx?$/.test(file));
  expect(files.length).toBeGreaterThan(5);
  for (const file of files) {
    const source = readFileSync(`${directory}/${file}`, 'utf8');
    expect(source.split('\n').length, file).toBeLessThan(file.startsWith('use') ? 850 : 550);
    if (file.endsWith('.tsx')) expect(source).not.toMatch(/useToolsStore|readJsonStorage|writeJsonStorage/);
  }
});
