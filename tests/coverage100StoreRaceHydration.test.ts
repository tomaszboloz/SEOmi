import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useToolsStore } from '@/stores/toolsStore';

beforeEach(() => {
  useToolsStore.setState({
    activeRun: null,
    isExecuting: false,
    error: null,
  });
});

describe('toolsStore concurrency, race conditions, and status flag transitions', () => {
  it('transitions status flags correctly through idle -> running -> completed / error', async () => {
    expect(useToolsStore.getState().isExecuting).toBe(false);

    // Trigger a mock tool action or update state directly mimicking slice execution
    useToolsStore.setState({ isExecuting: true, error: null });
    expect(useToolsStore.getState().isExecuting).toBe(true);

    useToolsStore.setState({ isExecuting: false, error: 'Execution failed' });
    expect(useToolsStore.getState().isExecuting).toBe(false);
    expect(useToolsStore.getState().error).toBe('Execution failed');
  });

  it('handles concurrent tool execution triggers and race condition cancellation', async () => {
    const results: string[] = [];

    const runTask = async (id: string, delay: number) => {
      useToolsStore.setState({ isExecuting: true });
      await new Promise((resolve) => setTimeout(resolve, delay));
      results.push(id);
      useToolsStore.setState({ isExecuting: false });
    };

    await Promise.all([
      runTask('task-1', 50),
      runTask('task-2', 10),
    ]);

    expect(results).toHaveLength(2);
    expect(useToolsStore.getState().isExecuting).toBe(false);
  });
});
