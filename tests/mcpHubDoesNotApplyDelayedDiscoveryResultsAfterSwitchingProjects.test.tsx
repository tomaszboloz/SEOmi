import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpHub } from '@/components/AgentWorkflows/McpHub';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { invokeTauriCommand } from '@/services/tauri';
import { saveTextFile } from '@/services/tauri';
vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(),
  isTauriEnvironment: () => true,
  saveTextFile: vi.fn(),
}));

describe('McpHub', () => {
beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({ activeProjectId: 'mcp-project' });
    useToolsStore.setState({ mcpClientTab: 'claude' });
    vi.mocked(invokeTauriCommand).mockReset();
    vi.mocked(saveTextFile).mockReset();
  });

it('does not apply delayed discovery results after switching projects', async () => {
    let resolveDiscovery!: (value: unknown) => void;
    vi.mocked(invokeTauriCommand).mockImplementation(() => new Promise((resolve) => { resolveDiscovery = resolve; }));
    render(<McpHub />);
    fireEvent.change(screen.getByRole('textbox', { name: /Absolute MCP server path/ }), { target: { value: '/Users/test/mcp-server/dist/index.js' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discover server tools' }));

    useProjectStore.setState({ activeProjectId: 'mcp-project-next' });
    resolveDiscovery({
      serverName: 'stale-mcp',
      serverVersion: '1.0',
      tools: [{ name: 'stale_tool', description: 'Stale', inputSchema: { type: 'object' } }],
    });
    await waitFor(() => expect(screen.queryByText(/stale-mcp/)).toBeNull());
    expect(screen.queryByText('stale_tool')).toBeNull();
  });
});
