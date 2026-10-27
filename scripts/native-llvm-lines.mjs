// Mirrors LLVM CoverageMapping.cpp LineCoverageStats / LineCoverageIterator.
// https://github.com/llvm/llvm-project/blob/llvmorg-21.1.0/llvm/lib/ProfileData/Coverage/CoverageMapping.cpp
export function llvmLineEvidence(file, maxLine = Number.MAX_SAFE_INTEGER) {
  const segments = file.segments;
  if (!Array.isArray(segments)) throw new Error('Missing LLVM line segments');
  let previous = [0, 0];
  for (const segment of segments) {
    if (!Array.isArray(segment) || segment.length !== 6
      || !segment.slice(0, 3).every(Number.isSafeInteger)
      || segment[0] < 1 || segment[0] > maxLine || segment[1] < 1 || segment[2] < 0
      || !segment.slice(3).every(value => typeof value === 'boolean')
      || segment[0] < previous[0] || (segment[0] === previous[0] && segment[1] < previous[1])) {
      throw new Error('Invalid LLVM line segment');
    }
    previous = segment;
  }
  const lines = new Map();
  let next = 0;
  let current = [];
  let wrapped = null;
  for (let line = segments[0]?.[0] ?? 1; next < segments.length; line++) {
    if (current.length) wrapped = current.at(-1);
    current = [];
    while (next < segments.length && segments[next][0] === line) current.push(segments[next++]);
    const starts = current.filter(segment => !segment[5] && segment[3] && segment[4]);
    const skipped = current.length > 0 && !current[0][3] && current[0][4];
    const mapped = (!skipped && (wrapped?.[3] || starts.length > 0))
      || current.some(segment => segment[4] && segment[3]);
    if (!mapped) continue;
    let hits = wrapped?.[2] ?? 0;
    for (const segment of starts) hits = Math.max(hits, segment[2]);
    lines.set(line, hits);
  }
  return lines;
}

export function assertLLVMLineEvidence(file, records, maxLine) {
  const actual = llvmLineEvidence(file, maxLine);
  const seen = new Set();
  for (const record of records) {
    const fields = record.slice(3).split(',');
    const [line, hits] = fields.map(Number);
    if (fields.length < 2 || !fields.slice(0, 2).every(value => /^\d+$/.test(value))
      || ![line, hits].every(Number.isSafeInteger) || line < 1 || hits < 0 || seen.has(line)) {
      throw new Error('Invalid or duplicate LCOV line evidence');
    }
    seen.add(line);
    if (actual.get(line) !== hits) throw new Error('LCOV and LLVM segment line evidence differ');
  }
  if (seen.size !== actual.size) throw new Error('LCOV and LLVM segment line evidence differ');
  // file.summary.lines sums source-function summaries, not unique physical lines.
  // Do not adjust these observed counters to force agreement with that aggregate.
}
