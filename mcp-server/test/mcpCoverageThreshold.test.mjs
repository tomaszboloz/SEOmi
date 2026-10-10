import assert from 'node:assert/strict';
import test from 'node:test';
import { assertMcpCoverage, assertMcpCoverageThreshold } from '../../scripts/run-mcp-coverage.mjs';

const counts = (total, covered, branch = false) => branch
  ? {0: Array.from({length: total}, (_, index) => index < covered ? 1 : 0)}
  : Object.fromEntries(Array.from({length: total}, (_, index) => [`${index}`, index < covered ? 1 : 0]));

const record = (total = 10000, statements = total, functions = total, branches = total) => ({
  s: counts(total, statements), f: counts(total, functions), b: counts(total, branches, true),
});

const report = (covered, total = 10000) => ({ '/tmp/fixture.ts': record(total, covered, covered, covered) });

test('rejects coverage below 98 percent', () => {
  assert.throws(() => assertMcpCoverageThreshold(report(9799)), /below 98%/);
});

test('accepts exactly 98 percent and returns real totals', () => {
  const summary = assertMcpCoverageThreshold(report(9800));
  assert.equal(summary.threshold, 98);
  for (const metric of Object.values(summary).slice(1)) assert.deepEqual(metric, {total: 10000, covered: 9800, percent: 98});
});

test('sums statements, functions, and branches across multiple records', () => {
  const summary = assertMcpCoverageThreshold({ '/tmp/one.ts': record(), '/tmp/two.ts': record() });
  for (const metric of Object.values(summary).slice(1)) assert.deepEqual(metric, {total: 20000, covered: 20000, percent: 100});
});

test('fails when functions alone are below the threshold', () => {
  assert.throws(() => assertMcpCoverageThreshold({ '/tmp/fixture.ts': record(10000, 10000, 9799, 10000) }), /functions coverage 97\.99%/);
});

test('fails when branches alone are below the threshold', () => {
  assert.throws(() => assertMcpCoverageThreshold({ '/tmp/fixture.ts': record(10000, 10000, 10000, 9799) }), /branches coverage 97\.99%/);
});

test('rejects missing and empty reports', () => {
  for (const value of [undefined, null, {}, []]) assert.throws(() => assertMcpCoverageThreshold(value), /empty|malformed|report/);
});

test('requires statements, functions, and branches in every record', () => {
  for (const metric of ['s', 'f', 'b']) {
    const value = report(10000);
    delete value['/tmp/fixture.ts'][metric];
    assert.throws(() => assertMcpCoverageThreshold(value), /empty|malformed/);
  }
});

test('rejects a zero denominator for every metric', () => {
  for (const metric of ['s', 'f', 'b']) {
    const value = report(10000);
    value['/tmp/fixture.ts'][metric] = {};
    assert.throws(() => assertMcpCoverageThreshold(value), /zero denominator/);
  }
});

test('rejects malformed, negative, and fractional counters', () => {
  for (const [metric, invalid] of [['s', -1], ['f', 0.5], ['b', [1, -1]]]) {
    const value = report(10000);
    value['/tmp/fixture.ts'][metric] = metric === 'b' ? {0: invalid} : {0: invalid};
    assert.throws(() => assertMcpCoverageThreshold(value), /Invalid/);
  }
});

const mapped = (total, covered) => {
  const ids = Array.from({length: total}, (_, id) => `${id}`);
  const values = Object.fromEntries(ids.map(id => [id, Number(Number(id) < covered)]));
  return {'/tmp/mapped.ts': {
    s: {...values}, f: {...values}, b: Object.fromEntries(ids.map(id => [id, [values[id]]])),
    statementMap: Object.fromEntries(ids.map(id => [id, {start: {line: Number(id) + 1}}])),
  }};
};

test('enforces exact 98 percent across statements, functions, branches and lines', () => {
  const summary = assertMcpCoverage(mapped(100, 98));
  for (const metric of ['statements', 'functions', 'branches', 'lines']) {
    assert.deepEqual(summary[metric], {total: 100, covered: 98, percent: 98});
  }
});

test('rejects an unrounded result below 98 percent and invalid line counters', () => {
  assert.throws(() => assertMcpCoverage(mapped(1099, 1077)), /statements coverage 98\.00% is below 98%/);
  const invalid = mapped(1, 1);
  invalid['/tmp/mapped.ts'].statementMap['0'].start.line = 0;
  assert.throws(() => assertMcpCoverage(invalid), /Invalid MCP line coverage data/);
});
