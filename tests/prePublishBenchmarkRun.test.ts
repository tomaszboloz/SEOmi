import { cpus, totalmem } from 'node:os';
import { describe, expect, it } from 'vitest';
import { benchmarkMarkdown, benchmarkPrePublish, type BenchmarkEnvironment } from '@/services/prePublish/benchmark';
import { prePublishContext } from '@/services/prePublish/context';
import { checkPrePublish } from '@/services/prePublish/embeddingCheck';
import { createCrawlPageFixture } from './fixtures/crawl';
import { createSemanticCrawlRunFixture } from './fixtures/semanticCrawlRun';

/**
 * Real-engine measurement for #94 GEM-94-09. Runs only when PREPUBLISH_BENCH=1 so CI timing noise
 * never fails a build. Usage: PREPUBLISH_BENCH=1 [PREPUBLISH_BENCH_PROVIDER=ollama] npx vitest run tests/prePublishBenchmarkRun.test.ts
 */
const enabled = process.env.PREPUBLISH_BENCH === '1';
const provider = process.env.PREPUBLISH_BENCH_PROVIDER ?? 'local';
const SIZES = [50, 200, 500];
const TOPICS = ['heat pump', 'heating', 'electricity', 'efficiency', 'insulation', 'radiator', 'thermostat', 'boiler'];

const corpusRun = (pages: number) => createSemanticCrawlRunFixture('bench', '2026-10-24T10:00:00Z', 'bench-project',
  Array.from({ length: pages }, (_, index) => createCrawlPageFixture({
    url: `https://example.test/page-${index}`, final_url: `https://example.test/page-${index}`,
    title: `${TOPICS[index % TOPICS.length]} guide ${index}`, word_count: 700, document_language: 'en',
    semantic_excerpts: [`${TOPICS[index % TOPICS.length]} costs ${index} EUR per year in a typical house.`],
    focus_terms: TOPICS.slice(index % 4, (index % 4) + 4).map((term) => ({ term, surface: term, count: 8, weight: 12 })),
  })));

const environment = (): BenchmarkEnvironment => ({
  platform: `${process.platform}-${process.arch}`, cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length || null,
  memoryGb: Math.round(totalmem() / 1024 ** 3), runtime: `node ${process.versions.node} (vitest)`,
});

const draft = 'A heat pump moves heat from outside air into the house. It uses 3 kWh of electricity per 10 kWh of heat.\n\nInstallers size heat pumps by heat loss in watts.';

describe.runIf(enabled)('pre-publish real-engine benchmark', () => {
  it('measures cold and warm checks per corpus size and prints a markdown table', async () => {
    const results = [];
    for (const pages of SIZES) {
      const context = prePublishContext('bench-project', [corpusRun(pages)]);
      const check = () => checkPrePublish(draft, 'https://example.test/new', context, { provider }, new AbortController().signal);
      results.push(await benchmarkPrePublish(check, { corpusPages: context.pages.length, provider, environment: environment() }));
    }
    console.info(`\n${benchmarkMarkdown(results)}\n`);
    expect(results).toHaveLength(SIZES.length);
  }, 600_000);
});

describe.skipIf(enabled)('pre-publish real-engine benchmark (disabled)', () => {
  it('is opt-in so CI timing never gates a build', () => {
    expect(enabled).toBe(false);
  });
});
