import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertMcpBudget, monthlyLimit, readLedger, recordMcpCost } from '../dist/dataForSeoBudget.js';
import { createProviderClient } from '../dist/providers.js';

const envWith = (limit) => ({ DATAFORSEO_MONTHLY_LIMIT_USD: limit, DATAFORSEO_LEDGER_PATH: join(mkdtempSync(join(tmpdir(), 'seomi-ledger-')), 'ledger.json'), DATAFORSEO_LOGIN: 'l', DATAFORSEO_PASSWORD: 'p' });
const ok = (cost) => new Response(JSON.stringify({ cost, tasks: [{ status_code: 20000, cost, result: [] }] }));

test('no limit means no ledger and no blocking', () => {
  const env = envWith(undefined);
  assert.equal(monthlyLimit(env), null);
  assert.equal(recordMcpCost(env, 1), null);
  assert.doesNotThrow(() => assertMcpBudget(env));
});

test('rejects an invalid limit', () => {
  assert.throws(() => monthlyLimit({ DATAFORSEO_MONTHLY_LIMIT_USD: '-1' }), /non-negative/);
  assert.throws(() => monthlyLimit({ DATAFORSEO_MONTHLY_LIMIT_USD: 'ten' }), /non-negative/);
});

test('records reported costs and blocks once the cap is used, before sending', async () => {
  const env = envWith('0.01');
  const fetch = async () => ok(0.006);
  const client = createProviderClient({ env, fetch });
  await client.dataForSeo('/v3/serp/google/organic/live/regular', [{}]);
  await client.dataForSeo('/v3/serp/google/organic/live/regular', [{}]);
  assert.deepEqual(readLedger(env.DATAFORSEO_LEDGER_PATH), { month: readLedger(env.DATAFORSEO_LEDGER_PATH).month, totalUsd: 0.012, calls: 2 });
  let sent = 0;
  const blocked = createProviderClient({ env, fetch: async () => { sent++; return ok(0.006); } });
  await assert.rejects(blocked.dataForSeo('/v3/serp/google/organic/live/regular', [{}]), /monthly limit reached/);
  assert.equal(sent, 0);
});

test('a new month starts from zero', () => {
  const env = envWith('5');
  recordMcpCost(env, 2, new Date(2026, 8, 30));
  assert.equal(JSON.parse(readFileSync(env.DATAFORSEO_LEDGER_PATH, 'utf8')).month, '2026-09');
  assert.deepEqual(readLedger(env.DATAFORSEO_LEDGER_PATH, new Date(2026, 9, 1)), { month: '2026-10', totalUsd: 0, calls: 0 });
});
