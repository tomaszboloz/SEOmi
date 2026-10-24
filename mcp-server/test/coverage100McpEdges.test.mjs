import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertMcpBudget, recordMcpCost } from '../dist/dataForSeoBudget.js';
import { canonicalHref, firstMeta } from '../dist/htmlAttrs.js';

test('covers empty HTML attribute fallbacks', () => {
  assert.equal(firstMeta('<meta content="orphan">', 'description'), null);
  assert.equal(canonicalHref('<link href="/without-rel">'), null);
});

test('covers releasing a reservation after its map entry was removed', () => {
  const env = {
    DATAFORSEO_MONTHLY_LIMIT_USD: '1',
    DATAFORSEO_LEDGER_PATH: join(mkdtempSync(join(tmpdir(), 'seomi-coverage100-')), 'ledger.json'),
  };
  const first = assertMcpBudget(env);
  env.DATAFORSEO_MONTHLY_LIMIT_USD = '100';
  recordMcpCost(env, 1e-12, new Date(2026, 9, 23));
  const second = assertMcpBudget(env);
  first();
  assert.doesNotThrow(second);
});
