import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseArgs, runCli, USAGE } from '@/services/embeddings/cli';
import { parseInputs, withFileCache } from '@/services/embeddings/io';
import { normalize } from '@/services/embeddings/vector';

const workdir = () => mkdtempSync(join(tmpdir(), 'seomi-embed-'));

describe('input parsing', () => {
  it('reads text lines, CSV first columns, JSON and JSONL and skips blanks', () => {
    expect(parseInputs('a\n\n b \n', 'txt').map(item => item.text)).toEqual(['a', 'b']);
    expect(parseInputs('"seo audit",10\nkeywords;5', 'csv').map(item => item.text)).toEqual(['seo audit', 'keywords']);
    expect(parseInputs('["x", {"id": 7, "text": "y"}, {"text": ""}]', '.json')).toEqual([{ id: '1', text: 'x' }, { id: '7', text: 'y' }]);
    expect(parseInputs('{"text":"a"}\n\n{"id":"k","text":"b"}', 'jsonl')).toEqual([{ id: '1', text: 'a' }, { id: 'k', text: 'b' }]);
    expect(() => parseInputs('{}', 'json')).toThrow(/array/);
    expect(parseInputs('x'.repeat(9000), 'txt')[0].text).toHaveLength(8000);
  });
});

describe('file cache', () => {
  it('embeds only texts it has not seen and persists vectors', async () => {
    const path = join(workdir(), 'cache.json');
    const inner = { id: 'p', model: 'm', embed: vi.fn(async (texts: string[]) => texts.map(text => normalize([text.length, 1]))) };
    const cached = withFileCache(inner, path);
    await cached.embed(['a', 'bb', 'a']);
    cached.save();
    const reloaded = withFileCache(inner, path);
    const [vector] = await reloaded.embed(['bb', 'ccc']);
    expect(inner.embed.mock.calls.map(call => call[0])).toEqual([['a', 'bb'], ['ccc']]);
    expect(vector.length).toBe(2);
  });
});

describe('command line', () => {
  it('parses flags and rejects stray or valueless arguments', () => {
    expect(parseArgs(['eval', '--k', '5'])).toEqual({ command: 'eval', options: { k: '5' } });
    expect(parseArgs([])).toEqual({ command: 'help', options: {} });
    expect(() => parseArgs(['eval', 'x'])).toThrow(/Unexpected/);
    expect(() => parseArgs(['eval', '--k'])).toThrow(/Missing value/);
  });

  it('prints usage for help and fails for unknown commands', async () => {
    const log = vi.fn();
    expect(await runCli(['help'], log)).toBe(0);
    expect(log).toHaveBeenCalledWith(USAGE);
    expect(await runCli(['nope'], log)).toBe(1);
  });

  it('passes the accuracy gate on the fixture and fails an impossible target', async () => {
    const log = vi.fn();
    expect(await runCli(['eval', '--dataset', 'tests/fixtures/embeddings/seo-topics.json'], log)).toBe(0);
    expect(log.mock.calls[0][0]).toMatch(/k=3: \d+\.\d% .*target 85%; cluster purity/);
    expect(await runCli(['eval', '--dataset', 'tests/fixtures/embeddings/seo-topics.json', '--min-accuracy', '1.01'], vi.fn())).toBe(1);
    await expect(runCli(['eval'], vi.fn())).rejects.toThrow(/--dataset is required/);
    await expect(runCli(['eval', '--dataset', 'x', '--k', 'abc'], vi.fn())).rejects.toThrow();
  });

  it('writes JSONL embeddings and cluster groups', async () => {
    const dir = workdir();
    const input = join(dir, 'keywords.txt');
    writeFileSync(input, 'robots txt disallow\nrobots.txt disallow rules\nhreflang x-default\n');
    expect(await runCli(['embed', '--input', input, '--output', join(dir, 'out.jsonl'), '--dimensions', '64'], vi.fn())).toBe(0);
    const rows = readFileSync(join(dir, 'out.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: '1', text: 'robots txt disallow', provider: 'local-hash' });
    expect(rows[0].vector).toHaveLength(64);
    expect(await runCli(['cluster', '--input', input, '--output', join(dir, 'groups.json'), '--threshold', '0.3'], vi.fn())).toBe(0);
    const groups = JSON.parse(readFileSync(join(dir, 'groups.json'), 'utf8'));
    expect(groups.map((group: { texts: string[] }) => group.texts.length)).toEqual([2, 1]);
  });
});
