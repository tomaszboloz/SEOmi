import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { CrawlRunRecord } from '@/types';
import { deriveCrawlStartedAt } from '@/services/optimizationTasks/runVerification';
import { createCrawlResultFixture } from './fixtures/crawl';

const parse = (name: string) => ts.createSourceFile(name, readFileSync(`src/types/${name}`, 'utf8'), ts.ScriptTarget.Latest, true);

describe('CrawlRunRecord.startedAt additive contract and backwards compatibility', () => {
  it('declares startedAt as an optional string on CrawlRunRecord', () => {
    const source = parse('crawl/history.ts');
    const iface = source.statements.find((n): n is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(n) && n.name.text === 'CrawlRunRecord');
    if (!iface) throw new Error('Missing CrawlRunRecord contract');
    const startedAt = iface.members.find((m) => m.name?.getText(source) === 'startedAt');
    if (!startedAt || !ts.isPropertySignature(startedAt)) throw new Error('Missing startedAt member');
    expect(startedAt.questionToken).toBeDefined();
    expect(startedAt.type?.getText(source)).toBe('string');
  });

  it('accepts legacy records without startedAt and derives from completedAt and duration', () => {
    const legacy: CrawlRunRecord = {
      id: 'legacy-run',
      startUrl: 'https://site.test/',
      completedAt: '2026-10-25T10:00:10.000Z',
      config: {} as never,
      result: { ...createCrawlResultFixture(), duration_ms: 10_000 },
    };
    expect(legacy.startedAt).toBeUndefined();
    expect(deriveCrawlStartedAt(legacy)).toBe('2026-10-25T10:00:00.000Z');
  });

  it('preserves explicit startedAt when present on modern records', () => {
    const modern: CrawlRunRecord = {
      id: 'modern-run',
      startUrl: 'https://site.test/',
      completedAt: '2026-10-25T10:00:10.000Z',
      startedAt: '2026-10-25T09:59:55.000Z',
      config: {} as never,
      result: { ...createCrawlResultFixture(), duration_ms: 15_000 },
    };
    expect(deriveCrawlStartedAt(modern)).toBe('2026-10-25T09:59:55.000Z');
  });

  it('returns undefined when neither startedAt nor completedAt/duration are available', () => {
    const empty = { startUrl: 'https://site.test/' } as CrawlRunRecord;
    expect(deriveCrawlStartedAt(empty)).toBeUndefined();
  });
});
