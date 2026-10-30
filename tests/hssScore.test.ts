import { describe, expect, it } from 'vitest';
import { computeHss, HSS_MODULES, HSS_PROFILE, hssExportPayload, reproducesHss, simulateHss, comparableHss, type HssModuleInput } from '@/services/hss';

const all: HssModuleInput[] = [
  { module: 'sfs', value: 80 }, { module: 'tas', value: 60 }, { module: 'igos', value: 50 }, { module: 'sprs', value: 40 },
  { module: 'eetv', value: 70 }, { module: 'sija', value: 30 }, { module: 'aior', value: 90 },
];
const pick = (...modules: string[]) => all.filter((input) => modules.includes(input.module));

describe('HSS (#72)', () => {
  it('profile weights sum to 1 and cover exactly the seven modules', () => {
    expect(Object.keys(HSS_PROFILE.weights).sort()).toEqual([...HSS_MODULES].sort());
    expect(Object.values(HSS_PROFILE.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('matches a hand-computed score with all seven modules', () => {
    const report = computeHss(all, 'run-1');
    expect(report).toMatchObject({ status: 'complete', value: 59, availableWeight: 1, measuredCount: 7, missing: [] });
  });

  it.each(HSS_MODULES)('singleton %s is renormalised but withheld below minimum coverage', (module) => {
    const report = computeHss(pick(module), 'run-1');
    const input = all.find((item) => item.module === module)!;
    expect(report.renormalisedValue).toBe(input.value);
    expect(report.status).toBe('insufficient');
    expect(report.value).toBeNull();
  });

  it('nothing measured is unavailable, never 0', () => {
    const report = computeHss([{ module: 'sfs', value: null, reason: 'x' }], 'run-1');
    expect(report).toMatchObject({ status: 'unavailable', value: null, renormalisedValue: null, availableWeight: 0 });
    expect(report.components.find((item) => item.module === 'sfs')?.reason).toBe('x');
    expect(computeHss([], 'r').components.every((item) => item.effectiveWeight === 0 && item.contribution === null)).toBe(true);
  });

  it('a measured 0 counts while null is excluded from the denominator', () => {
    const partial = computeHss(pick('sfs', 'tas', 'eetv', 'aior'), 'run-1');
    expect(partial).toMatchObject({ status: 'partial', value: 70.8, availableWeight: 0.6 });
    const zero = computeHss([{ module: 'sfs', value: 0 }, ...pick('tas', 'eetv', 'aior'), { module: 'igos', value: null }], 'run-1');
    expect(zero.value).toBe(44.2);
    expect(zero.components.find((item) => item.module === 'sfs')?.status).toBe('measured');
  });

  it('applies the minimum coverage boundary inclusively', () => {
    expect(computeHss(pick('sfs', 'tas', 'aior'), 'r').status).toBe('partial');
    expect(computeHss(pick('sfs', 'tas'), 'r').status).toBe('insufficient');
  });

  it('rejects NaN, out-of-range and other-run inputs', () => {
    const report = computeHss([
      { module: 'sfs', value: Number.NaN }, { module: 'tas', value: 101 }, { module: 'igos', value: -1 },
      { module: 'eetv', value: 70, runId: 'old' }, { module: 'aior', value: 90, runId: 'run-1' },
    ], 'run-1');
    const status = Object.fromEntries(report.components.map((item) => [item.module, item.status]));
    expect(status).toMatchObject({ sfs: 'invalid', tas: 'invalid', igos: 'invalid', eetv: 'incompatible', aior: 'measured' });
    expect(report.availableWeight).toBe(0.05);
  });

  it('export reproduces the score and What-If never mutates the baseline', () => {
    const baseline = computeHss(pick('sfs', 'tas', 'eetv', 'aior'), 'run-1');
    const snapshot = JSON.stringify(baseline);
    expect(reproducesHss(hssExportPayload(baseline))).toBe(true);
    expect(reproducesHss({ ...hssExportPayload(baseline), value: 99 })).toBe(false);
    const whatIf = simulateHss(baseline, { sfs: 90 });
    expect(whatIf.scenario.value).toBe(74.2);
    expect(whatIf.delta).toBe(3.4);
    expect(simulateHss(baseline, { igos: 100 }).scenario.measuredCount).toBe(5);
    expect(simulateHss(baseline, { tas: null, sfs: null }).delta).toBeNull();
    expect(JSON.stringify(baseline)).toBe(snapshot);
  });

  it('refuses What-If across profiles and compares trends only within one profile', () => {
    const baseline = computeHss(all, 'r');
    expect(() => simulateHss(baseline, {}, { ...HSS_PROFILE, version: 2 })).toThrow('hss-profile-mismatch');
    expect(comparableHss(baseline, { profile: { id: HSS_PROFILE.id, version: 2 } })).toBe(false);
    expect(comparableHss(baseline, computeHss([], 'other'))).toBe(true);
  });
});
