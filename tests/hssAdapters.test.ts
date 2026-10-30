import { describe, expect, it } from 'vitest';
import { computeHss, DOMAIN_AGGREGATION_UNDEFINED, hssInputsFromReports } from '@/services/hss';
import type { AioReport } from '@/services/aioReadiness';
import type { TrustReport } from '@/services/eeatTrust';
import type { SiteFocusReport } from '@/services/siteFocus';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';

const sfs = { score: 72, unavailable: false } as unknown as SiteFocusReport;
const tas = { tas: 55 } as unknown as TopicalAuthorityReport;
const trust = { score: 64, availability: 'observed' } as unknown as TrustReport;
const aio = (patch: Partial<AioReport> = {}) => ({ score: 81, availability: 'complete', scoredCount: 3, ...patch }) as unknown as AioReport;
const values = (inputs: ReturnType<typeof hssInputsFromReports>) => Object.fromEntries(inputs.map((input) => [input.module, input.value]));
const reasons = (inputs: ReturnType<typeof hssInputsFromReports>) => Object.fromEntries(inputs.map((input) => [input.module, input.reason]));

describe('HSS adapters (#72 GEM-72-01/06)', () => {
  it('reads only the scalars each engine reports; per-page modules stay unavailable', () => {
    const inputs = hssInputsFromReports({ runId: 'r', sfs, tas, trust, aio: aio() });
    expect(values(inputs)).toEqual({ sfs: 72, tas: 55, igos: null, sprs: null, eetv: 64, sija: null, aior: 81 });
    expect(reasons(inputs)).toMatchObject({ igos: DOMAIN_AGGREGATION_UNDEFINED, sprs: DOMAIN_AGGREGATION_UNDEFINED, sija: DOMAIN_AGGREGATION_UNDEFINED });
    const report = computeHss(inputs, 'r');
    expect(report.status).toBe('partial');
    expect(report.availableWeight).toBe(0.6);
  });

  it('never turns a missing or unmeasured module into 0', () => {
    const inputs = hssInputsFromReports({ runId: 'r', sfs: { ...sfs, unavailable: true }, tas: { ...tas, tas: null }, trust: { ...trust, score: null }, aio: aio({ availability: 'unavailable' }) });
    expect(Object.values(values(inputs)).every((value) => value === null)).toBe(true);
    expect(reasons(inputs)).toMatchObject({ sfs: 'sfs-no-scored-pages', tas: 'tas-no-reference-map', eetv: 'eetv-no-signals', aior: 'aio-unavailable' });
    expect(reasons(hssInputsFromReports({ runId: 'r' }))).toMatchObject({ sfs: 'not-run', tas: 'not-run', eetv: 'not-run', aior: 'not-run' });
    expect(computeHss(inputs, 'r').status).toBe('unavailable');
  });

  it('marks AIO from another run or a stale snapshot as incompatible, partial AIO as measured', () => {
    const other = computeHss(hssInputsFromReports({ runId: 'r', aio: aio({ sourceSnapshot: { crawlRunId: 'old' } }) }), 'r');
    expect(other.components.find((item) => item.module === 'aior')?.status).toBe('incompatible');
    const stale = computeHss(hssInputsFromReports({ runId: 'r', aio: aio({ availability: 'stale' }) }), 'r');
    expect(stale.components.find((item) => item.module === 'aior')?.status).toBe('incompatible');
    const partial = hssInputsFromReports({ runId: 'r', aio: aio({ availability: 'partial' }) }).find((item) => item.module === 'aior');
    expect(partial).toMatchObject({ value: 81, reason: 'aio-partial' });
    expect(hssInputsFromReports({ runId: 'r', aio: aio({ scoredCount: 0 }) }).find((item) => item.module === 'aior')?.value).toBeNull();
  });
});
