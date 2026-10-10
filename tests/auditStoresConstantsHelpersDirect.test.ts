import { describe, expect, it, vi } from 'vitest';
import { onlyProblemsKey } from '@/stores/audit/auditConstants';
import { persistAuditHistory } from '@/stores/audit/auditHelpers';
import { createAuditBatchSlice } from '@/stores/audit/auditBatchSlice';
import { createAuditMainSlice } from '@/stores/audit/auditMainSlice';
import { createAuditSeoSlice } from '@/stores/audit/auditSeoSlice';
import { mockAudit } from './fixtures/auditStoreContracts';

describe('audit stores constants, slices, and helpers direct assertions', () => {
  it('onlyProblemsKey generates project-specific key', () => {
    expect(onlyProblemsKey('p-1')).toBe('seomi_project_p-1_audit_only_problems_v1');
  });

  it('persistAuditHistory saves history array to storage', () => {
    const result = persistAuditHistory('proj-test', [mockAudit]);
    expect(result.saved).toBe(true);
  });

  it('createAuditBatchSlice returns slice actions', () => {
    const set = vi.fn();
    const get = vi.fn().mockReturnValue({ batchItems: [] });
    const slice = createAuditBatchSlice(set, get, {} as any);

    expect(typeof slice.importAuditCsv).toBe('function');
    expect(typeof slice.startBatchAudits).toBe('function');
    expect(typeof slice.stopBatchAudits).toBe('function');
    expect(typeof slice.clearBatchAudits).toBe('function');
    expect(typeof slice.hydrateProject).toBe('function');
  });

  it('createAuditMainSlice returns slice actions', () => {
    const set = vi.fn();
    const get = vi.fn().mockReturnValue({});
    const slice = createAuditMainSlice(set, get, {} as any);

    expect(typeof slice.startAudit).toBe('function');
    expect(typeof slice.setAuditData).toBe('function');
    expect(typeof slice.setActiveTab).toBe('function');
    expect(typeof slice.clearAudit).toBe('function');
  });

  it('createAuditSeoSlice returns slice actions', () => {
    const set = vi.fn();
    const get = vi.fn().mockReturnValue({});
    const slice = createAuditSeoSlice(set, get, {} as any);

    expect(typeof slice.fetchDataForSEO).toBe('function');
    expect(typeof slice.fetchDataForSEOSerp).toBe('function');
    expect(typeof slice.setDataForSEOData).toBe('function');
  });
});
