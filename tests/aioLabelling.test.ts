import { describe, expect, it } from 'vitest';
import type { AioSnapshot } from '@/services/aioReadiness/history';
import { AIO_LABELLING_HEADER, aioLabellingCsv, aioLabellingPairs, parseAioLabellingCsv, sweepAioThresholds } from '@/services/monitoringAlerts';

const profile = { id: 'aio-r', algorithmVersion: 'v1', configHash: 'h1', language: 'en', market: 'us' };
const snap = (runId: string, at: string, score: number, extra: Partial<AioSnapshot> = {}): AioSnapshot =>
  ({ runId, at, score, selfContainment: 0, spoDensity: 0, extractability: 0, scored: 1, weakPassages: 0, profile, ...extra });

describe('AIO calibration labelling round-trip (#108)', () => {
  it('pairs consecutive snapshots in time order and skips profile changes and non-finite scores', () => {
    const pairs = aioLabellingPairs([
      snap('r3', '2026-03-01', 60), snap('r1', '2026-01-01', 80), snap('r2', '2026-02-01', 75.04),
      snap('r4', '2026-04-01', 50, { profile: { ...profile, configHash: 'h2' } }), snap('r5', '2026-05-01', Number.NaN, { profile: { ...profile, configHash: 'h2' } }),
      snap('r6', '2026-06-01', 40, { profile: undefined }), snap('r7', '2026-07-01', 45, { profile: undefined }),
    ]);
    expect(pairs).toEqual([
      { id: 'r1>r2', before: 80, after: 75.04, drop: 5, at: '2026-02-01' },
      { id: 'r2>r3', before: 75.04, after: 60, drop: 15, at: '2026-03-01' },
      { id: 'r6>r7', before: 40, after: 45, drop: -5, at: '2026-07-01' },
    ]);
    expect(aioLabellingPairs([])).toEqual([]);
  });

  it('writes a sheet with an empty label column and neutralised formula cells', () => {
    const csv = aioLabellingCsv([{ id: '=cmd', before: 40, after: 45, drop: -5, at: '2026-07-01' }]);
    const [header, row] = csv.split('\n');
    expect(header).toBe(AIO_LABELLING_HEADER);
    expect(row).toBe('"\'=cmd","40","45","\'-5","2026-07-01",""');
  });

  it('parses labelled rows back, keeping blank labels unlabelled and reporting bad lines', () => {
    const csv = [
      AIO_LABELLING_HEADER,
      '"r1>r2","80","70","10","2026-02-01","ALERT"',
      '"r2>r3","70","68","2","2026-03-01","no-alert"',
      '"r3>r4","68","60","8","2026-04-01",""',
      '"r4>r5","x","60","8","2026-05-01","alert"',
      '"r5>r6","60","50","10","2026-06-01","maybe"',
      '"r1>r2","80","70","10","2026-02-01","alert"',
      '"short","1"',
      '"q""uote","50","45","\'-5","2026-07-01","alert"',
      '',
    ].join('\r\n');
    const parsed = parseAioLabellingCsv(csv);
    expect(parsed.cases).toEqual([
      { id: 'r1>r2', before: 80, after: 70, expected: 'alert' },
      { id: 'r2>r3', before: 70, after: 68, expected: 'no-alert' },
      { id: 'q"uote', before: 50, after: 45, expected: 'alert' },
    ]);
    expect(parsed.unlabelled).toBe(1);
    expect(parsed.errors).toEqual([
      { line: 5, reason: 'score' }, { line: 6, reason: 'label' }, { line: 7, reason: 'duplicate' }, { line: 8, reason: 'columns' },
    ]);
  });

  it('feeds the sweep only once enough human labels of both classes exist', () => {
    const rows = (count: number, label: string) => Array.from({ length: count }, (_, i) =>
      `"${label}${i}","80","${label === 'alert' ? 60 : 78}","","","${label}"`);
    const few = parseAioLabellingCsv(rows(3, 'alert').join('\n'));
    expect(sweepAioThresholds(few.cases).status).toBe('insufficient-labels');
    const enough = parseAioLabellingCsv([...rows(12, 'alert'), ...rows(12, 'no-alert')].join('\n'));
    const sweep = sweepAioThresholds(enough.cases);
    expect(sweep.status).toBe('recommended');
    expect(sweep.provenance).toBe('caller-supplied-labels');
  });
});
