import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { eraseProjectData, forgetSubject } from '@/services/dataErasure';
import { forgetGa4Reports, ga4ReportStorageKey, recallGa4Report, rememberGa4Report } from '@/services/urlTelemetry/ga4Cache';
import * as storage from '@/services/storage';
import { ga4Report } from './fixtures/ga4Report';

const native = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: native }));

beforeEach(() => {
  forgetGa4Reports();
  localStorage.clear();
  native.mockReset();
  native.mockResolvedValue({ projectId: 'p', action: 'erase_project' });
});
afterEach(() => vi.restoreAllMocks());

it.each(['project', 'subject'])('erases persisted and in-memory GA4 for a %s wipe only', async kind => {
  rememberGa4Report('p', ga4Report());
  rememberGa4Report('q', ga4Report());
  localStorage.setItem('seomi_store_v2_migrated_p', '1');
  if (kind === 'project') await eraseProjectData('p');
  else await forgetSubject('p', 'subject');
  expect(localStorage.getItem(ga4ReportStorageKey('p'))).toBeNull();
  expect(recallGa4Report('p')).toBeNull();
  expect(recallGa4Report('q')).toEqual(ga4Report());
  expect(localStorage.getItem(ga4ReportStorageKey('q'))).not.toBeNull();
});

it('erases a stored report even when the cache has never seen its project', async () => {
  localStorage.setItem(ga4ReportStorageKey('p'), JSON.stringify(ga4Report()));
  await eraseProjectData('p');
  expect(localStorage.getItem(ga4ReportStorageKey('p'))).toBeNull();
  expect(recallGa4Report('p')).toBeNull();
});

it('reports a failed persistent GA4 deletion rather than claiming erasure', async () => {
  localStorage.setItem(ga4ReportStorageKey('p'), JSON.stringify(ga4Report()));
  vi.spyOn(storage, 'removeStorage').mockReturnValue(false);
  await expect(eraseProjectData('p')).rejects.toThrow(ga4ReportStorageKey('p'));
});
