const validCount = value => Number.isSafeInteger(value) && value >= 0;

const recordsFor = (coverage, threshold) => {
  if (!coverage || typeof coverage !== 'object' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new Error('Invalid MCP coverage report or threshold');
  }
  const records = Object.values(coverage);
  if (!records.length || records.some(record => !record || typeof record !== 'object')) {
    throw new Error('MCP coverage report is empty or malformed');
  }
  for (const record of records) {
    if (!record.s || !record.f || !record.b || Array.isArray(record.s) || Array.isArray(record.f) || Array.isArray(record.b)) {
      throw new Error('MCP coverage report is empty or malformed');
    }
  }
  return records;
};

const metricTotals = (records, metric, branches = false) => {
  let total = 0;
  let covered = 0;
  for (const record of records) {
    const values = Object.values(record[metric]);
    if (branches && values.some(value => !Array.isArray(value))) throw new Error(`Invalid ${metric} coverage counts`);
    const counts = branches ? values.flat() : values;
    if (counts.some(value => !validCount(value))) throw new Error(`Invalid ${metric} coverage counts`);
    total += counts.length;
    covered += counts.filter(value => value > 0).length;
  }
  if (!total) throw new Error(`MCP ${metric} coverage has a zero denominator`);
  return { total, covered, percent: (covered * 100) / total };
};

const lineTotals = records => {
  const lines = new Map();
  for (const [recordIndex, record] of records.entries()) {
    for (const [id, count] of Object.entries(record.s)) {
      const line = record.statementMap?.[id]?.start?.line;
      if (!Number.isSafeInteger(line) || line < 1 || !validCount(count)) throw new Error('Invalid MCP line coverage data');
      const key = `${recordIndex}:${line}`;
      lines.set(key, Math.max(lines.get(key) || 0, count));
    }
  }
  const values = [...lines.values()];
  if (!values.length) throw new Error('MCP lines coverage has a zero denominator');
  return { total: values.length, covered: values.filter(value => value > 0).length, percent: (values.filter(value => value > 0).length * 100) / values.length };
};

const enforce = (metrics, threshold) => {
  for (const [name, result] of Object.entries(metrics)) {
    if (result.covered * 100 < result.total * threshold) throw new Error(`MCP ${name} coverage ${result.percent.toFixed(2)}% is below ${threshold}%`);
  }
  return { threshold, ...metrics };
};

export function assertMcpCoverageThreshold(coverage, threshold = 98) {
  const records = recordsFor(coverage, threshold);
  return enforce({
    statements: metricTotals(records, 's'),
    functions: metricTotals(records, 'f'),
    branches: metricTotals(records, 'b', true),
  }, threshold);
}

export function assertMcpCoverage(coverage, threshold = 98) {
  const records = recordsFor(coverage, threshold);
  return enforce({
    statements: metricTotals(records, 's'),
    functions: metricTotals(records, 'f'),
    branches: metricTotals(records, 'b', true),
    lines: lineTotals(records),
  }, threshold);
}
