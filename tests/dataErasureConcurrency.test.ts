import { afterEach, expect, it, vi } from 'vitest';
import { eraseProjectData } from '../src/services/dataErasure';
import { saveCrawlRuns } from '../src/services/crawlPersistence';
import { withCrawlWriteLock } from '../src/services/crawlPersistence/writeLock';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@/services/tauri', () => native);

afterEach(() => {
  native.invokeTauriCommand.mockReset();
  localStorage.clear();
});

it('invalidates a queued stale snapshot before project erasure runs', async () => {
  localStorage.setItem('seomi_store_v2_migrated_p', '1');
  native.invokeTauriCommand.mockImplementation(async (command: string) => {
    if (command === 'store_erase_project') {
      return { auditId: 1, projectId: 'p', subjectId: '', action: 'erase_project', keyId: '',
        recordsDeleted: 0, runsDeleted: 0, atMs: 1 };
    }
    return undefined;
  });
  let release!: () => void;
  const blocker = withCrawlWriteLock('p', () => new Promise<void>(resolve => { release = resolve; }));
  await Promise.resolve();
  await Promise.resolve();
  const staleSave = saveCrawlRuns('p', []);
  const erase = eraseProjectData('p');
  release();

  await expect(staleSave).rejects.toThrow('invalidated');
  await expect(erase).resolves.toMatchObject({ action: 'erase_project' });
  await blocker;
  expect(native.invokeTauriCommand).not.toHaveBeenCalledWith('store_replace_crawl_runs', expect.anything());
  expect(native.invokeTauriCommand).toHaveBeenCalledWith('store_erase_project', { projectId: 'p' });
});
