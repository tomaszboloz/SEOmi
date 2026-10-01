import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProjectBackup,
  parseProjectBackup,
  PROJECT_BACKUP_FORMAT,
  restoreProjectBackup,
  serializeProjectBackup,
} from '@/services/projectBackup';
import type { SeoProject } from '@/types';

const project: SeoProject = {
  id: 'source-project',
  name: 'Source project',
  rootUrl: 'https://example.com',
  createdAt: '2026-09-24T00:00:00.000Z',
  lastOpenedAt: '2026-09-24T00:00:00.000Z',
};

describe('project backup', () => {
  beforeEach(() => localStorage.clear());

  it('exports only project-scoped data and marks secrets as excluded', async () => {
    localStorage.setItem('seomi_project_source-project_active_tab_v1', 'site-audit');
    localStorage.setItem('seomi_project_other-project_active_tab_v1', 'overview');
    localStorage.setItem('seomi_ai_provider', 'openai');

    const backup = await createProjectBackup(project);

    expect(backup.format).toBe(PROJECT_BACKUP_FORMAT);
    expect(backup.localStorage).toEqual({ active_tab_v1: 'site-audit' });
    expect(backup.secretsExcluded).toBe(true);
  });

  it('round-trips JSON and rejects a different format', () => {
    const serialized = serializeProjectBackup({
      format: PROJECT_BACKUP_FORMAT,
      exportedAt: '2026-09-24T00:00:00.000Z',
      project,
      localStorage: { active_tab_v1: 'site-audit' },
      crawlRuns: [],
      secretsExcluded: true,
    });

    expect(parseProjectBackup(serialized).project.name).toBe('Source project');
    expect(() => parseProjectBackup(serialized.replace(PROJECT_BACKUP_FORMAT, 'unknown'))).toThrow(/format/i);
  });

  it('restores suffixes under a new project id without overwriting the source', async () => {
    localStorage.setItem('seomi_project_source-project_active_tab_v1', 'source-tab');
    const backup = parseProjectBackup(serializeProjectBackup({
      format: PROJECT_BACKUP_FORMAT,
      exportedAt: '2026-09-24T00:00:00.000Z',
      project,
      localStorage: { active_tab_v1: 'site-audit' },
      crawlRuns: [],
      secretsExcluded: true,
    }));

    const summary = await restoreProjectBackup(backup, 'restored-project');

    expect(summary.storageEntries).toBe(1);
    expect(localStorage.getItem('seomi_project_source-project_active_tab_v1')).toBe('source-tab');
    expect(localStorage.getItem('seomi_project_restored-project_active_tab_v1')).toBe('site-audit');
  });

  it('rolls back already-written keys when storage quota rejects a later entry', async () => {
    localStorage.setItem('seomi_project_restored-project_existing_v1', 'keep-me');
    const backup = parseProjectBackup(serializeProjectBackup({
      format: PROJECT_BACKUP_FORMAT,
      exportedAt: '2026-09-24T00:00:00.000Z',
      project,
      localStorage: { first_v1: 'one', second_v1: 'two' },
      crawlRuns: [],
      secretsExcluded: true,
    }));
    const originalSetItem = Storage.prototype.setItem;
    let writes = 0;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      writes += 1;
      if (writes === 2) throw new DOMException('quota', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });

    await expect(restoreProjectBackup(backup, 'restored-project')).rejects.toThrow(/restore|quota/i);
    expect(localStorage.getItem('seomi_project_restored-project_first_v1')).toBeNull();
    expect(localStorage.getItem('seomi_project_restored-project_second_v1')).toBeNull();
    expect(localStorage.getItem('seomi_project_restored-project_existing_v1')).toBe('keep-me');
    setItem.mockRestore();
  });
});

it('rejects oversized backup input before invoking the JSON parser', () => {
  const parser = vi.spyOn(JSON, 'parse');
  try {
    expect(() => parseProjectBackup(' '.repeat(26 * 1024 * 1024))).toThrow(/limit|limitowany|rozmiar|large|duż/i);
    expect(parser).not.toHaveBeenCalled();
  } finally { parser.mockRestore(); }
});
