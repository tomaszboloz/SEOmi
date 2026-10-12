import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { nativeText } from '@/services/ai/native';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke }));

beforeEach(() => invoke.mockReset());
afterEach(() => vi.restoreAllMocks());

it('rejects malformed native JSON without exposing the raw response', async () => {
  invoke.mockResolvedValue('not-json-with-private-details');
  await expect(nativeText('openai', 'gpt-test', 'prompt')).rejects.toThrow('invalid response');
  await expect(nativeText('openai', 'gpt-test', 'prompt')).rejects.not.toThrow('private-details');
});
