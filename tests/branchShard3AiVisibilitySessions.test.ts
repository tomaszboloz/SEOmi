import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useAiBrandVisibilitySession } from '@/components/AiVisibility/brandVisibility/useAiBrandVisibilitySession';
import { useAuthStore } from '@/stores/authStore';

const initial = useAuthStore.getState();
afterEach(() => {
  cleanup();
  act(() => { useAuthStore.setState(initial); });
});

it('lists only providers that use a local CLI and are connected', () => {
  act(() => {
    useAuthStore.setState({
      connectionMethod: { openai: 'local_cli', claude: 'local_cli', gemini: 'api_key' },
      connectionStatus: { openai: 'connected', claude: 'disconnected', gemini: 'connected' },
    } as never);
  });
  const { result } = renderHook(() => useAiBrandVisibilitySession());
  expect(result.current.connectedProviders).toEqual(['openai']);
});
