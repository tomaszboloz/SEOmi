import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import { useAiSearchPromptsSession } from '@/components/AiVisibility/searchPrompts/useAiSearchPromptsSession';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { createCrawlRunFixture } from './fixtures/crawl';

const mocks = vi.hoisted(() => ({ copyText: vi.fn(), match: vi.fn(), write: vi.fn(), remove: vi.fn(), read: vi.fn() }));
vi.mock('@/services/clipboard', () => ({ copyText: mocks.copyText }));
vi.mock('@/services/aiCitationEvidence', () => ({ matchAiCitationToCrawl: mocks.match }));
vi.mock('@/services/storage', async (importOriginal) => ({ ...(await importOriginal<object>()), readStorage: mocks.read, writeStorage: mocks.write, removeStorage: mocks.remove }));

const tools = useToolsStore.getState();
const projects = useProjectStore.getState();
const spies = { setAiSearchPrompt: vi.fn(), runAiPromptComparison: vi.fn() };
const runs = [createCrawlRunFixture({ id: 'r1' }), createCrawlRunFixture({ id: 'r2' })];
const evt = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockReturnValue(null); mocks.write.mockReturnValue(true); mocks.remove.mockReturnValue(true); mocks.copyText.mockResolvedValue(true);
  mocks.match.mockImplementation((c: { id: string }) => ({ id: c.id, matched: c.id !== 'x', context: c.id === 'a' ? { meetsMinimum: true, sentenceMatch: true } : undefined }));
  useProjectStore.setState({ activeProjectId: 'proj' });
  useToolsStore.setState({ crawlRuns: runs, selectedCrawlRunId: null, aiSearchPrompt: '', aiPromptComparison: null, ...spies } as never);
});
afterEach(() => { useToolsStore.setState(tools); useProjectStore.setState(projects); });

it('defaults the source run to the first run, then to the selected run, then to a saved run', () => {
  const first = renderHook(() => useAiSearchPromptsSession());
  expect(first.result.current.sourceContextRunId).toBe('r1');
  expect(first.result.current.sourceContextRun?.id).toBe('r1');
  first.unmount();
  useToolsStore.setState({ selectedCrawlRunId: 'r2' });
  expect(renderHook(() => useAiSearchPromptsSession()).result.current.sourceContextRunId).toBe('r2');
  mocks.read.mockReturnValue('r1');
  expect(renderHook(() => useAiSearchPromptsSession()).result.current.sourceContextRunId).toBe('r1');
  mocks.read.mockReturnValue('gone');
  expect(renderHook(() => useAiSearchPromptsSession()).result.current.sourceContextRunId).toBe('r2');
});

it('has no source run without a project or runs', () => {
  useProjectStore.setState({ activeProjectId: null });
  const none = renderHook(() => useAiSearchPromptsSession());
  expect(none.result.current.sourceContextRunId).toBe('');
  act(() => none.result.current.selectSourceContextRun('r2'));
  expect(mocks.write).not.toHaveBeenCalled();
  useProjectStore.setState({ activeProjectId: 'proj' });
  useToolsStore.setState({ crawlRuns: [] });
  expect(renderHook(() => useAiSearchPromptsSession()).result.current.sourceContextRunId).toBe('');
});

it('persists, clears and reports storage failures for the chosen source run', () => {
  const { result } = renderHook(() => useAiSearchPromptsSession());
  act(() => result.current.selectSourceContextRun('r2'));
  expect(mocks.write).toHaveBeenCalledWith('seomi_project_proj_ai_citation_crawl_context_v1', 'r2');
  expect(result.current.sourceContextSaveError).toBe(false);
  mocks.write.mockReturnValue(false);
  act(() => result.current.selectSourceContextRun('r1'));
  expect(result.current.sourceContextSaveError).toBe(true);
  act(() => result.current.selectSourceContextRun(''));
  expect(mocks.remove).toHaveBeenCalledWith('seomi_project_proj_ai_citation_crawl_context_v1');
  expect(result.current.sourceContextSaveError).toBe(false);
});

it('summarises citation evidence per result', () => {
  const cit = (id: string) => ({ id });
  useToolsStore.setState({ aiPromptComparison: { results: [{ response_text: 'txt', citations: [cit('a'), cit('b'), cit('x')] }, { response_text: '', citations: [] }] } as never });
  const { result } = renderHook(() => useAiSearchPromptsSession());
  expect(result.current.citationSummaries).toEqual([{ total: 3, matched: 2, contextual: 1, sentenceMatches: 1 }, { total: 0, matched: 0, contextual: 0, sentenceMatches: 0 }]);
  expect(mocks.match).toHaveBeenCalledWith({ id: 'a' }, expect.objectContaining({ id: 'r1' }), 'txt');
  expect(result.current.citationsWithEvidence[0]).toHaveLength(3);
});

it('compares only a non-blank prompt, trimmed', () => {
  useToolsStore.setState({ aiSearchPrompt: '   ' });
  const blank = renderHook(() => useAiSearchPromptsSession());
  const e = evt();
  act(() => blank.result.current.handleCompare(e));
  expect(e.preventDefault).toHaveBeenCalled();
  expect(spies.runAiPromptComparison).not.toHaveBeenCalled();
  useToolsStore.setState({ aiSearchPrompt: ' best crm ' });
  const filled = renderHook(() => useAiSearchPromptsSession());
  act(() => filled.result.current.handleCompare(evt()));
  expect(spies.setAiSearchPrompt).toHaveBeenCalledWith('best crm');
  expect(spies.runAiPromptComparison).toHaveBeenCalledWith('best crm');
  expect(Array.isArray(filled.result.current.samplePrompts)).toBe(true);
});

it('marks a prompt as copied only when the clipboard succeeds', async () => {
  const { result } = renderHook(() => useAiSearchPromptsSession());
  mocks.copyText.mockResolvedValueOnce(false);
  await act(async () => result.current.handleCopy('a', 1));
  expect(result.current.copiedIdx).toBeNull();
  await act(async () => result.current.handleCopy('b', 2));
  await waitFor(() => expect(result.current.copiedIdx).toBe(2));
  expect(mocks.copyText).toHaveBeenLastCalledWith('b');
});

it('falls back to an empty id when the selected run has a blank id', () => {
  useToolsStore.setState({ crawlRuns: [createCrawlRunFixture({ id: '' })], selectedCrawlRunId: '' });
  const { result } = renderHook(() => useAiSearchPromptsSession());
  expect(result.current.sourceContextRunId).toBe('');
});
