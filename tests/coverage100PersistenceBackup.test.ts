import { afterEach, expect, it } from 'vitest';
import { createProjectBackup, restoreProjectBackup, serializeProjectBackup } from '@/services/projectBackup';
import { loadCrawlRuns } from '@/services/crawlPersistence';
import { createCrawlRunFixture } from './fixtures/crawl';

const project = { id: 'backup-source', name: 'Observed', rootUrl: 'https://site.test',
  createdAt: '2026-10-01T00:00:00.000Z', lastOpenedAt: '2026-10-01T00:00:00.000Z' };

afterEach(() => localStorage.clear());

it('exports and restores crawl history alongside project-scoped settings', async () => {
  const run = createCrawlRunFixture({ id: 'backup-run' });
  localStorage.setItem('seomi_project_backup-source_active_tab_v1', 'audit');
  localStorage.setItem('seomi_project_backup-source_crawl_runs', JSON.stringify([run]));
  localStorage.setItem('seomi_ai_provider', 'must-stay-global');
  const backup = await createProjectBackup(project);
  expect(backup.crawlRuns).toEqual([run]);
  expect(backup.localStorage).toMatchObject({ active_tab_v1: 'audit', crawl_runs: JSON.stringify([run]) });
  const restored = await restoreProjectBackup(JSON.parse(serializeProjectBackup(backup)), 'backup-target');
  expect(restored).toMatchObject({ storageEntries: 2, crawlRuns: 1, sourceProjectName: 'Observed' });
  expect(await loadCrawlRuns('backup-target')).toEqual([run]);
  expect(localStorage.getItem('seomi_project_backup-source_active_tab_v1')).toBe('audit');
  expect(localStorage.getItem('seomi_ai_provider')).toBe('must-stay-global');
});

it('keeps malformed source crawl history out of a backup', async () => {
  localStorage.setItem('seomi_project_backup-source_crawl_runs', JSON.stringify([{ id: 'broken' }]));
  const backup = await createProjectBackup(project);
  expect(backup.crawlRuns).toEqual([]);
});
