import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '@/services/embeddings/cli';
import { PROVIDER_FACTORIES } from '@/services/embeddings/registry';
import { createLocalHashProvider } from '@/services/embeddings/localProvider';

let directory: string;
let input: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'seomi-embedding-cli-'));
  input = join(directory, 'texts.txt');
  writeFileSync(input, 'coffee brewing\ncoffee brewing\n');
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  vi.unstubAllGlobals();
  delete PROVIDER_FACTORIES['fixture-local'];
});

describe('embedding CLI cache, validation and cluster naming', () => {
  it('rejects nonnumeric dimensions on an existing input before writing output', async () => {
    await expect(runCli(['embed', '--input', input, '--output', join(directory, 'out.jsonl'), '--dimensions', 'NaN'], vi.fn()))
      .rejects.toThrow('--dimensions must be a number');
  });
  it('saves and reloads a real embedding cache with identical output vectors', async () => {
    const output = join(directory, 'out.jsonl');
    const cache = join(directory, 'cache.json');
    const args = ['embed', '--input', input, '--output', output, '--cache', cache, '--dimensions', '64'];
    expect(await runCli(args, vi.fn())).toBe(0);
    const first = readFileSync(output, 'utf8');
    const entries = JSON.parse(readFileSync(cache, 'utf8'));
    expect(Object.keys(entries)).toHaveLength(1);
    expect(Object.values(entries)[0]).toHaveLength(64);
    expect(await runCli(args, vi.fn())).toBe(0);
    expect(readFileSync(output, 'utf8')).toBe(first);
    const rows = first.trim().split('\n').map(line => JSON.parse(line));
    expect(rows.map(row => row.id)).toEqual(['1', '2']);
    expect(rows[0].vector).toEqual(rows[1].vector);
  });
  it('names clusters through the explicit Ollama endpoint without an output file', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: 'Coffee preparation' }),
      { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    const log = vi.fn();
    expect(await runCli(['cluster', '--input', input, '--label-model', 'fixture-label-model', '--ollama-url', 'http://127.0.0.1:11434'], log)).toBe(0);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/generate');
    expect(JSON.parse(request.body)).toMatchObject({ model: 'fixture-label-model', stream: false });
    expect(log).toHaveBeenCalledWith('#1 Coffee preparation (2): coffee brewing | coffee brewing');
  });
  it('supports a registered provider without a predefined clustering threshold', async () => {
    PROVIDER_FACTORIES['fixture-local'] = () => createLocalHashProvider({ dimensions: 64 });
    const log = vi.fn();
    expect(await runCli(['cluster', '--input', input, '--provider', 'fixture-local'], log)).toBe(0);
    expect(log).toHaveBeenCalledExactlyOnceWith('#1 (2): coffee brewing | coffee brewing');
  });
});
