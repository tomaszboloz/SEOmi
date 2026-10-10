import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAIAssistantSession } from '@/components/AI/assistant/useAIAssistantSession';
import { useAiBrandVisibilitySession } from '@/components/AiVisibility/brandVisibility/useAiBrandVisibilitySession';

describe('direct hook call expression assertions', () => {
  it('useAIAssistantSession initializes cleanly via direct function call', () => {
    const { result, unmount } = renderHook(() => useAIAssistantSession());
    expect(result.current).toBeDefined();
    expect(typeof result.current.closeModal).toBe('function');
    unmount();
  });

  it('useAiBrandVisibilitySession initializes cleanly via direct function call', () => {
    const { result, unmount } = renderHook(() => useAiBrandVisibilitySession());
    expect(result.current).toBeDefined();
    expect(typeof result.current.setAiBrandQuery).toBe('function');
    const preventDefault = vi.fn();
    result.current.handleQuery({ preventDefault } as any);
    expect(preventDefault).toHaveBeenCalled();
    unmount();
  });
});
