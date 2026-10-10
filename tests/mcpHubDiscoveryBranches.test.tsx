import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpHub } from '@/components/AgentWorkflows/McpHub';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { invokeTauriCommand } from '@/services/tauri';
import i18n from '@/i18n';

vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(),
  isTauriEnvironment: () => true,
  saveTextFile: vi.fn(),
}));

const KEY = 'seomi_project_mcp-a_mcp_server_path_v1';
const PATH = '/srv/mcp/dist/index.js';
const pathBox = () => screen.getByRole('textbox', { name: i18n.t('mcp.serverPathAria') }) as HTMLInputElement;
const discover = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('mcp.discover') }));
const server = (names: string[]) => ({
  serverName: 'srv', serverVersion: '2.0',
  tools: names.map((name) => ({ name, description: `${name} desc`, inputSchema: { type: 'object', properties: { url: {} } } })),
});

describe('McpHub discovery branches', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    useProjectStore.setState({ activeProjectId: 'mcp-a' });
    useToolsStore.setState({ mcpClientTab: 'claude' });
    vi.mocked(invokeTauriCommand).mockReset();
  });

  it('persists the trimmed path per project and removes it when cleared', () => {
    render(<McpHub />);
    fireEvent.change(pathBox(), { target: { value: `  ${PATH} ` } });
    expect(localStorage.getItem(KEY)).toBe(PATH);
    fireEvent.change(pathBox(), { target: { value: '   ' } });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('restores the saved path on mount and does not persist without a project', () => {
    localStorage.setItem(KEY, PATH);
    const { unmount } = render(<McpHub />);
    expect(pathBox().value).toBe(PATH);
    unmount();
    useProjectStore.setState({ activeProjectId: null });
    render(<McpHub />);
    expect(pathBox().value).toBe('');
    localStorage.clear();
    fireEvent.change(pathBox(), { target: { value: PATH } });
    expect(localStorage.length).toBe(0);
  });

  it('refuses to discover for relative or non-js paths', () => {
    render(<McpHub />);
    fireEvent.change(pathBox(), { target: { value: 'relative/index.js' } });
    expect((screen.getByRole('button', { name: i18n.t('mcp.discover') }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(pathBox(), { target: { value: '/abs/index.ts' } });
    expect((screen.getByRole('button', { name: i18n.t('mcp.discover') }) as HTMLButtonElement).disabled).toBe(true);
    expect(invokeTauriCommand).not.toHaveBeenCalled();
  });

  it('shows discovered tools with their arguments and the summary', async () => {
    vi.mocked(invokeTauriCommand).mockResolvedValue(server(['x_audit', 'x_backlinks', 'x_other']));
    render(<McpHub />);
    fireEvent.change(pathBox(), { target: { value: PATH } });
    discover();
    expect(await screen.findByText(i18n.t('mcp.discoveredSummary', { count: 3, server: 'srv', version: '2.0' }))).toBeTruthy();
    expect(invokeTauriCommand).toHaveBeenCalledWith('discover_mcp_tools', { serverPath: PATH });
    expect(screen.getAllByText('x_audit').length).toBeGreaterThan(0);
    expect(screen.getByText('x_other')).toBeTruthy();
  });

  it('reports Error and non-Error discovery failures', async () => {
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('spawn failed')).mockRejectedValueOnce('plain failure');
    render(<McpHub />);
    fireEvent.change(pathBox(), { target: { value: PATH } });
    discover();
    expect((await screen.findByRole('alert')).textContent).toContain('spawn failed');
    discover();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('plain failure'));
    expect(screen.queryByText(/spawn failed/)).toBeNull();
  });

  it('ignores a discovery failure that arrives after switching projects', async () => {
    let reject!: (e: Error) => void;
    vi.mocked(invokeTauriCommand).mockImplementation(() => new Promise((_, r) => { reject = r; }));
    render(<McpHub />);
    fireEvent.change(pathBox(), { target: { value: PATH } });
    discover();
    useProjectStore.setState({ activeProjectId: 'mcp-b' });
    reject(new Error('stale failure'));
    await waitFor(() => expect(screen.queryByText(/stale failure/)).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the selected tool across rediscovery when it still exists', async () => {
    vi.mocked(invokeTauriCommand).mockResolvedValue(server(['seomi_audit_url', 'other']));
    render(<McpHub />);
    fireEvent.change(pathBox(), { target: { value: PATH } });
    discover();
    await screen.findByText(i18n.t('mcp.discoveredSummary', { count: 2, server: 'srv', version: '2.0' }));
    vi.mocked(invokeTauriCommand).mockResolvedValue(server(['newtool']));
    discover();
    await screen.findByText(i18n.t('mcp.discoveredSummary', { count: 1, server: 'srv', version: '2.0' }));
    expect(screen.getAllByText('newtool').length).toBeGreaterThan(0);
  });

  it('ignores a successful discovery that arrives after switching projects', async () => {
    let resolve!: (v: ReturnType<typeof server>) => void;
    vi.mocked(invokeTauriCommand).mockImplementation(() => new Promise((r) => { resolve = r; }));
    render(<McpHub />);
    fireEvent.change(pathBox(), { target: { value: PATH } });
    discover();
    useProjectStore.setState({ activeProjectId: 'mcp-b' });
    resolve(server(['late_tool']));
    await waitFor(() => expect(screen.queryByText('late_tool')).toBeNull());
    expect(screen.queryByText(/srv/)).toBeNull();
  });

  it('handles servers with no tools and tools without declared arguments', async () => {
    const bare = { serverName: 'srv', serverVersion: '2.0', tools: [{ name: 'bare', description: 'd', inputSchema: {} }] };
    vi.mocked(invokeTauriCommand).mockResolvedValueOnce(bare).mockResolvedValueOnce(server([]));
    render(<McpHub />);
    fireEvent.change(pathBox(), { target: { value: PATH } });
    discover();
    await screen.findByText(i18n.t('mcp.discoveredSummary', { count: 1, server: 'srv', version: '2.0' }));
    expect(screen.getAllByText(i18n.t('mcp.noArguments')).length).toBeGreaterThan(0);
    discover();
    await screen.findByText(i18n.t('mcp.discoveredSummary', { count: 0, server: 'srv', version: '2.0' }));
    expect(screen.queryByText('bare')).toBeNull();
  });

  it('returns early when discover is clicked with empty or invalid server path', () => {
    render(<McpHub />);
    discover();
    expect(invokeTauriCommand).not.toHaveBeenCalled();
  });
});
