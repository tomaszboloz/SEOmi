import { describe, expect, it } from 'vitest';
import {
  domainFromInput,
  ageInDays,
  isSeoToolId,
  tabStorageKey,
} from '@/components/SeoTools/workspace/seoToolsTypes';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

describe('SeoToolsWorkspace modular architecture', () => {
  it('satisfies physical LOC <= 150 across SeoToolsWorkspace and submodules', () => {
    const files = [
      'src/components/SeoTools/SeoToolsWorkspace.tsx',
      ...codeFiles('src/components/SeoTools/workspace'),
    ];
    expect(files.length).toBe(8);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('normalizes domain input strings correctly', () => {
    expect(domainFromInput('example.com')).toBe('example.com');
    expect(domainFromInput('https://www.example.com/path')).toBe('example.com');
    expect(domainFromInput('http://sub.example.com')).toBe('sub.example.com');
    expect(() => domainFromInput('invalid')).toThrow('invalid');
    expect(() => domainFromInput('localhost')).toThrow('invalid');
  });

  it('calculates age in days correctly', () => {
    const today = new Date().toISOString();
    expect(ageInDays(today)).toBe(0);
    const future = new Date(Date.now() + 100_000_000).toISOString();
    expect(ageInDays(future)).toBeNull();
    expect(ageInDays('invalid-date')).toBeNull();
  });

  it('validates tool IDs and generates storage keys', () => {
    expect(isSeoToolId('competitor-analysis')).toBe(true);
    expect(isSeoToolId('domain-age')).toBe(true);
    expect(isSeoToolId('unknown-tool')).toBe(false);
    expect(isSeoToolId(null)).toBe(false);
    expect(tabStorageKey('p1')).toBe('seomi_project_p1_seo_tools_tab_v1');
  });
});
