import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eraseProjectData, forgetSubject } from '@/services/dataErasure';
import {
  readLlmBudget, readLlmSpend, recordLlmCost, writeLlmBudget,
} from '@/services/llmEconomy/llmBudget';
import {
  exactCacheSize, findProjectCachedTask, storeProjectTask,
} from '@/services/llmEconomy/semanticCache';

const native = vi.hoisted(() => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@/services/tauri', () => native);

const P = 'proj_erasure_test';
const mockReport = {
  auditId: 1, projectId: P, subjectId: 's', action: 'erase_project' as const,
  keyId: 'k', recordsDeleted: 1, runsDeleted: 0, atMs: Date.now(),
};

beforeEach(() => {
  localStorage.clear();
  native.invokeTauriCommand.mockImplementation(async (command: string) => {
    if (command === 'load_project_crawl_runs') return [];
    if (command === 'store_import_legacy_runs') return 0;
    return mockReport;
  });
});

afterEach(() => {
  native.invokeTauriCommand.mockReset();
  localStorage.clear();
});

describe('LLM economy project erasure and cache boundary', () => {
  it('erases project budget, spend ledger and in-memory cache when erasing project', async () => {
    writeLlmBudget(P, { monthlyLimitUsd: 25, warnAtPercent: 80 });
    recordLlmCost(P, { providerId: 'openai', costUsd: 1.5 });
    storeProjectTask(P, 'openai', 'gpt-4o', 'Private prompt', 'Private answer', 1.5);

    expect(readLlmBudget(P).monthlyLimitUsd).toBe(25);
    expect(readLlmSpend(P).spentUsd).toBe(1.5);
    expect(exactCacheSize(P)).toBe(1);
    expect(findProjectCachedTask(P, 'gpt-4o', 'Private prompt')).not.toBeNull();

    await eraseProjectData(P);

    expect(readLlmBudget(P).monthlyLimitUsd).toBeNull();
    expect(readLlmSpend(P).spentUsd).toBe(0);
    expect(readLlmSpend(P).calls).toBe(0);
    expect(readLlmSpend(P).lastCall).toBeNull();
    expect(exactCacheSize(P)).toBe(0);
    expect(findProjectCachedTask(P, 'gpt-4o', 'Private prompt')).toBeNull();
  });

  it('erases project budget, spend and cache when forgetting subject', async () => {
    writeLlmBudget(P, { monthlyLimitUsd: 50, warnAtPercent: 90 });
    recordLlmCost(P, { providerId: 'claude', costUsd: 3.0 });
    storeProjectTask(P, 'claude', 'sonnet', 'Subject prompt', 'Subject response', 3.0);

    await forgetSubject(P, 'subj-1');

    expect(readLlmBudget(P).monthlyLimitUsd).toBeNull();
    expect(readLlmSpend(P).spentUsd).toBe(0);
    expect(exactCacheSize(P)).toBe(0);
  });
});
