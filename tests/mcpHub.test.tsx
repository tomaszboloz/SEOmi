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

it('lists exactly the tools exposed by the local server and does not offer fake execution', () => {
    render(<McpHub />);

    expect(screen.getByText('Provide the full path to the built server to generate configuration.')).not.toBeNull();
    expect(screen.queryByText(/args = \[""\]/)).toBeNull();
    expect(screen.getAllByText('seomi_audit_url')).toHaveLength(2);
    expect(screen.getAllByText('seomi_crawl_site')).toHaveLength(1);
    expect(screen.getByText('seomi_research_keywords')).not.toBeNull();
    expect(screen.getByText('seomi_research_serp')).not.toBeNull();
    expect(screen.getByText('seomi_research_backlinks')).not.toBeNull();
    expect(screen.getByText('seomi_research_backlink_anchors')).not.toBeNull();
    expect(screen.getByText('seomi_research_backlink_pages')).not.toBeNull();
    expect(screen.getByText('seomi_research_backlink_gap')).not.toBeNull();
    expect(screen.getByText('seomi_research_ranked_keywords')).not.toBeNull();
    expect(screen.queryByText('seomi_domain_overview')).toBeNull();
    expect(screen.queryByText(/Simulated MCP Response|Execute Tool Locally/)).toBeNull();
  });

it('labels the multi-page crawl as local and does not imply DataForSEO billing', () => {
    render(<McpHub />);
    fireEvent.click(screen.getByText('seomi_crawl_site'));
    expect(screen.getByText(/This local server tool does not require a DataForSEO account/)).not.toBeNull();
    expect(screen.queryByText(/This tool queries DataForSEO live/)).toBeNull();
  });

it('labels Search Console MCP tools separately from DataForSEO tools', () => {
    render(<McpHub />);
    fireEvent.click(screen.getByText('seomi_gsc_search_analytics'));

    expect(screen.getByText(/This tool queries Google Search Console live/)).not.toBeNull();
    expect(screen.getByText(/GOOGLE_ACCESS_TOKEN/)).not.toBeNull();
    expect(screen.queryByText(/odpytuje DataForSEO na żywo/)).toBeNull();
  });

it('saves the user-supplied server path per project and generates Codex TOML', () => {
    render(<McpHub />);

    fireEvent.change(screen.getByRole('textbox', { name: /Absolute MCP server path/ }), { target: { value: '/Users/test/SEOmi/mcp-server/dist/index.js' } });
    expect(localStorage.getItem('seomi_project_mcp-project_mcp_server_path_v1')).toBe('/Users/test/SEOmi/mcp-server/dist/index.js');
    fireEvent.click(screen.getByRole('button', { name: 'Codex' }));
    expect(screen.getByText(/\[mcp_servers\.seomi\]/)).not.toBeNull();
    expect(screen.getByText(/args = \["\/Users\/test\/SEOmi\/mcp-server\/dist\/index.js"\]/)).not.toBeNull();
    expect(screen.getByRole('button', { name: /Copy config/ }).hasAttribute('disabled')).toBe(false);
  });

it('accepts an absolute Windows server path regardless of extension casing', () => {
    render(<McpHub />);

    fireEvent.change(screen.getByRole('textbox', { name: /Absolute MCP server path/ }), {
      target: { value: 'C:\\SEOmi\\mcp-server\\dist\\index.JS' },
    });

    expect(screen.getByRole('button', { name: /Copy config/ }).hasAttribute('disabled')).toBe(false);
  });

it('exports only the selected client configuration after an explicit click', () => {
    vi.mocked(saveTextFile).mockResolvedValue('saved');
    render(<McpHub />);
    fireEvent.change(screen.getByRole('textbox', { name: /Absolute MCP server path/ }), {
      target: { value: '/Users/test/mcp-server/dist/index.js' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save configuration file' }));

    expect(saveTextFile).toHaveBeenCalledWith({
      defaultPath: 'seomi-mcp-claude.json',
      contents: expect.stringContaining('"/Users/test/mcp-server/dist/index.js"'),
      extension: 'json',
      filterName: 'JSON configuration',
    });
    expect(saveTextFile).not.toHaveBeenCalledWith(expect.objectContaining({
      contents: expect.stringMatching(/PASSWORD|TOKEN|credential/i),
    }));
  });

it('exports Codex configuration as TOML when that client is selected', () => {
    vi.mocked(saveTextFile).mockResolvedValue('saved');
    render(<McpHub />);
    fireEvent.change(screen.getByRole('textbox', { name: /Absolute MCP server path/ }), {
      target: { value: '/Users/test/mcp-server/dist/index.js' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Codex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save configuration file' }));

    expect(saveTextFile).toHaveBeenCalledWith({
      defaultPath: 'seomi-mcp-codex.toml',
      contents: expect.stringContaining('[mcp_servers.seomi]'),
      extension: 'toml',
      filterName: 'TOML configuration',
    });
  });

it('shows a translated error instead of throwing when the file export is rejected', async () => {
    vi.mocked(saveTextFile).mockRejectedValueOnce(new Error('download blocked'));
    render(<McpHub />);
    fireEvent.change(screen.getByRole('textbox', { name: /Absolute MCP server path/ }), {
      target: { value: '/Users/test/mcp-server/dist/index.js' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save configuration file' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('The configuration file could not be exported.');
    });
  });

it('discovers tools and input schemas from the configured local MCP process', async () => {
    vi.mocked(invokeTauriCommand).mockResolvedValueOnce({
      serverName: 'test-mcp',
      serverVersion: '2.1',
      tools: [{ name: 'custom_read_tool', description: 'Read a public report.', inputSchema: { type: 'object', properties: { report_id: { type: 'string' } } } }],
    });
    render(<McpHub />);
    fireEvent.change(screen.getByRole('textbox', { name: /Absolute MCP server path/ }), { target: { value: '/Users/test/mcp-server/dist/index.js' } });
    fireEvent.click(screen.getByRole('button', { name: 'Discover server tools' }));

    expect(await screen.findByText('1 tool discovered from test-mcp 2.1')).not.toBeNull();
    expect(screen.getAllByText('custom_read_tool')).toHaveLength(2);
    expect(screen.getByText('Arguments: report_id')).not.toBeNull();
    fireEvent.click(screen.getByText('JSON input schema'));
    expect(screen.getByText(/"report_id"/)).not.toBeNull();
    expect(invokeTauriCommand).toHaveBeenCalledWith('discover_mcp_tools', { serverPath: '/Users/test/mcp-server/dist/index.js' });
  });
});
