import { beforeEach, expect, it, vi } from 'vitest';
import { parseProjectBackup, restoreProjectBackup, PROJECT_BACKUP_FORMAT } from '@/services/projectBackup';
import i18n from '@/i18n';
import { saveCrawlRuns } from '@/services/crawlPersistence';
vi.mock('@/services/crawlPersistence', () => ({ loadCrawlRuns: vi.fn(async () => []), saveCrawlRuns: vi.fn(async () => ({ prunedRuns: 0 })) }));
beforeEach(() => localStorage.clear());
const backup = (local: Record<string, string>, id = 'source') => ({ format: PROJECT_BACKUP_FORMAT, exportedAt: '2026-10-01T00:00:00Z',
  project: { id, name: 'Observed source', createdAt: '2026-10-01', lastOpenedAt: '2026-10-01' }, localStorage: local, crawlRuns: [], secretsExcluded: true as const });
it('rejects imported raw keys outside the source project allowlist before writing any data', async () => {
  localStorage.setItem('seomi_ai_provider', 'keep');
  await expect(restoreProjectBackup(backup({ active_tab_v1: 'overview', __raw__seomi_ai_provider: 'overwrite' }), 'target'))
    .rejects.toThrow(i18n.t('runtimeErrors.backup.entry'));
  expect(localStorage.getItem('seomi_ai_provider')).toBe('keep');
  expect(localStorage.getItem('seomi_project_target_active_tab_v1')).toBeNull();
});
it('rejects raw keys belonging to another project at the parser boundary', () => {
  expect(() => parseProjectBackup(JSON.stringify(backup({ __raw__seomi_gsc_property_other: 'foreign' }))))
    .toThrow(i18n.t('runtimeErrors.backup.entry'));
});
it('maps the exact project identifier rather than replacing its spelling inside a prefix', async () => {
  await restoreProjectBackup(backup({ __raw__seomi_gsc_property_seomi: 'observed' }, 'seomi'), 'target');
  expect(localStorage.getItem('seomi_gsc_property_target')).toBe('observed');
  expect(localStorage.getItem('target_gsc_property_seomi')).toBeNull();
});
it('preserves a literal prototype-named storage suffix as own data', async () => {
  const local = JSON.parse('{"__proto__":"observed","constructor":"literal"}') as Record<string, string>;
  const parsed = parseProjectBackup(JSON.stringify(backup(local)));
  expect(Object.hasOwn(parsed.localStorage, '__proto__')).toBe(true);
  expect(parsed.localStorage.__proto__).toBe('observed');
  await restoreProjectBackup(parsed, 'target');
  expect(localStorage.getItem('seomi_project_target___proto__')).toBe('observed');
  expect(localStorage.getItem('seomi_project_target_constructor')).toBe('literal');
});

it('does not let a failed restore roll back a later successful restore of the same project', async () => {
  localStorage.setItem('seomi_project_target_active_tab_v1', 'original');
  let reject!: (error: Error) => void;
  vi.mocked(saveCrawlRuns).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  const first = restoreProjectBackup(backup({ active_tab_v1: 'first' }), 'target').catch(error => error);
  await vi.waitFor(() => expect(reject).toBeTypeOf('function'));
  const second = restoreProjectBackup(backup({ active_tab_v1: 'second' }), 'target');
  await Promise.resolve(); reject(new Error('native save failed'));
  expect(await first).toBeInstanceOf(Error); await second;
  expect(localStorage.getItem('seomi_project_target_active_tab_v1')).toBe('second');
});
