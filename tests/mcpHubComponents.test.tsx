import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { McpClientTabs } from '../src/components/AgentWorkflows/mcpHub/McpClientTabs';
import { McpServerConfigCard } from '../src/components/AgentWorkflows/mcpHub/McpServerConfigCard';
import { McpToolsList } from '../src/components/AgentWorkflows/mcpHub/McpToolsList';
import { Search } from 'lucide-react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/services/tauri', () => ({
  isTauriEnvironment: () => true,
  saveTextFile: vi.fn(),
}));
vi.mock('@/services/clipboard', () => ({
  copyText: vi.fn(),
}));

describe('McpClientTabs', () => {
  it('renders tabs and handles clicks', () => {
    const onTabChange = vi.fn();
    render(<McpClientTabs mcpClientTab="claude" onTabChange={onTabChange} />);
    expect(screen.getByText('mcp.clientClaude')).toBeTruthy();
    fireEvent.click(screen.getByText('mcp.clientCursor'));
    expect(onTabChange).toHaveBeenCalledWith('cursor');
  });
});

describe('McpServerConfigCard', () => {
  it('renders config card', () => {
    render(
      <McpServerConfigCard
        mcpClientTab="claude"
        setMcpClientTab={vi.fn()}
        serverPath="C:/seomi/server.js"
        updateServerPath={vi.fn()}
        discoverTools={vi.fn()}
        discovering={false}
        discoveryError=""
      />
    );
    expect(screen.getByText('mcp.clientConfig')).toBeTruthy();
  });
});

describe('McpToolsList', () => {
  it('renders tools list', () => {
    const toolsList = [
      { id: '1', name: 'tool1', description: 'desc', input: 'input1', icon: Search, inputSchema: {} }
    ];
    render(
      <McpToolsList
        toolsList={toolsList}
        selectedToolId="1"
        setSelectedToolId={vi.fn()}
        discovery={null}
      />
    );
    expect(screen.getAllByText('tool1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('desc').length).toBeGreaterThan(0);
  });
});
