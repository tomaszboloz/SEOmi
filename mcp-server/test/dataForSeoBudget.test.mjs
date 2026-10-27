import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
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

test('parallel calls cannot overshoot the cap: unknown cost reserves the remainder', async () => {
  const env = envWith('0.01');
  const client = createProviderClient({ env, fetch: async () => { await new Promise((r) => setTimeout(r, 5)); return ok(0.006); } });
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => client.dataForSeo('/v3/serp/google/organic/live/regular', [{}])));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(results.some((r) => r.status === 'rejected' && /reserved by requests in flight/.test(String(r.reason))));
  assert.equal(readLedger(env.DATAFORSEO_LEDGER_PATH).totalUsd, 0.006);
});

test('parallel calls with a known cost reserve that cost; a failed request releases its reservation', async () => {
  const env = envWith('0.02');
  const run = (fetch) => createProviderClient({ env, fetch }).dataForSeo('/v3/x', [{}]);
  await run(async () => ok(0.006));
  const slow = async () => { await new Promise((r) => setTimeout(r, 5)); return ok(0.006); };
  const settled = await Promise.allSettled([run(slow), run(slow), run(slow), run(slow)]);
  assert.equal(settled.filter((r) => r.status === 'fulfilled').length, 3);
  assert.equal(readLedger(env.DATAFORSEO_LEDGER_PATH).totalUsd, 0.024);
  const env2 = envWith('0.02');
  const run2 = (fetch) => createProviderClient({ env: env2, fetch }).dataForSeo('/v3/x', [{}]);
  await assert.rejects(run2(async () => new Response('x', { status: 500 })), /HTTP 500/);
  await assert.rejects(run2(async () => new Response('x', { status: 500 })), /HTTP 500/);
});

test('release is idempotent and no-limit returns a no-op', () => {
  assert.equal(typeof assertMcpBudget({}), 'function');
  const env = envWith('5');
  const release = assertMcpBudget(env);
  release(); release();
  assert.doesNotThrow(() => assertMcpBudget(env)());
});

test('an interrupted write keeps the previous ledger intact and leaves no partial JSON', () => {
  const env = envWith('5');
  recordMcpCost(env, 1);
  mkdirSync(`${env.DATAFORSEO_LEDGER_PATH}.tmp`);
  assert.throws(() => recordMcpCost(env, 1));
  assert.equal(readLedger(env.DATAFORSEO_LEDGER_PATH).totalUsd, 1);
  assert.equal(JSON.parse(readFileSync(env.DATAFORSEO_LEDGER_PATH, 'utf8')).calls, 1);
});
