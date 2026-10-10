import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeText } from '../dist/auditSemantic.js';
import { monthKey } from '../dist/dataForSeoBudget.js';

test('decodeText decodes named and numeric HTML entities without changing unknown text', () => {
  assert.equal(
    decodeText('&nbsp;&#160;&amp;&AMP;&lt;&LT;&gt;&GT;&quot;&#34;&apos;&#39;&unknown;'),
    '  &&<<>>""\'\'&unknown;',
  );
  assert.equal(decodeText('plain & text'), 'plain & text');
});

test('monthKey uses local calendar years and zero-padded months', () => {
  assert.equal(monthKey(new Date(2026, 0, 1, 0, 0, 0)), '2026-01');
  assert.equal(monthKey(new Date(2026, 8, 30, 23, 59, 59)), '2026-09');
  assert.equal(monthKey(new Date(2026, 11, 31, 23, 59, 59)), '2026-12');
});
