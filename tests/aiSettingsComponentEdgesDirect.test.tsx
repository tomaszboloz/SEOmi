import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AIAssistantEngineSelect } from '@/components/AI/assistant/AIAssistantEngineSelect';
import { AIAssistantSuggestions } from '@/components/AI/assistant/AIAssistantSuggestions';
import { McpToolsList } from '@/components/AgentWorkflows/mcpHub/McpToolsList';
import { Search } from 'lucide-react';
import type { AiSuggestionResponse } from '@/services/ai';

vi.mock('@/components/AI/ProviderModelSelect', () => ({
  ProviderModelSelect: () => <select aria-label="ai.modelLabel"><option>remote-model</option></select>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const t = ((key: string, options?: { count?: number }) => options?.count ? `${key}:${options.count}` : key) as never;
const methods = { openai: 'api_key', claude: 'api_key', gemini: 'api_key' } as const;

it('covers each engine state and the local CLI model notice', () => {
  const setProvider = vi.fn();
  const view = render(<AIAssistantEngineSelect provider="claude" setProvider={setProvider} connectionMethod={methods} t={t} />);
  expect(screen.getByRole('button', { name: /legacyUi\.ai\.openai/ }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: /legacyUi\.ai\.claude/ }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('combobox')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /legacyUi\.ai\.openai/ }));
  fireEvent.click(screen.getByRole('button', { name: /legacyUi\.ai\.gemini/ }));
  expect(setProvider.mock.calls.map(([provider]) => provider)).toEqual(['openai', 'gemini']);
  view.rerender(<AIAssistantEngineSelect provider="gemini" setProvider={setProvider} connectionMethod={{ ...methods, gemini: 'local_cli' }} t={t} />);
  expect(screen.getByText('auth.localModelNote')).toBeTruthy();
  expect(screen.queryByRole('combobox')).toBeNull();
});

it('renders applied states and omits optional suggestion sections when empty', () => {
  const suggestions: AiSuggestionResponse = { suggestedTitle: 'Title', suggestedDescription: 'Description', keyImprovements: [], schemaJsonLd: undefined };
  const applyTitle = vi.fn(); const applyDescription = vi.fn();
  const view = render(<AIAssistantSuggestions suggestions={suggestions} applyTitle={applyTitle} applyDescription={applyDescription} appliedField="title" copySchema={vi.fn()} copiedJson={true} t={t} />);
  expect(screen.getAllByRole('button', { name: 'ai.applied' })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'ai.applyDesc' })).toBeTruthy();
  expect(screen.queryByText('ai.keyImprovements')).toBeNull();
  expect(screen.queryByText('ai.schemaJsonLd')).toBeNull();
  view.rerender(<AIAssistantSuggestions suggestions={suggestions} applyTitle={applyTitle} applyDescription={applyDescription} appliedField="desc" copySchema={vi.fn()} copiedJson={false} t={t} />);
  expect(screen.getByRole('button', { name: 'ai.applyTitle' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'ai.applied' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'ai.applyTitle' }));
  fireEvent.click(screen.getByRole('button', { name: 'ai.applied' }));
  expect(applyTitle).toHaveBeenCalledOnce();
  expect(applyDescription).toHaveBeenCalledOnce();
  view.rerender(<AIAssistantSuggestions suggestions={{ ...suggestions, schemaJsonLd: { '@type': 'WebPage' } }} applyTitle={applyTitle} applyDescription={applyDescription} appliedField={null} copySchema={vi.fn()} copiedJson={true} t={t} />);
  expect(screen.getByRole('button', { name: 'ai.copied' })).toBeTruthy();
});

it('shows schema details and routes local, GSC and DataForSEO notices', () => {
  const tools = [
    { id: 'seomi_audit_url', name: 'audit', description: 'audit desc', input: '{}', icon: Search, inputSchema: { type: 'object' } },
    { id: 'seomi_gsc_search_analytics', name: 'gsc', description: 'gsc desc', input: '{}', icon: Search, inputSchema: {} },
    { id: 'other', name: 'other', description: 'other desc', input: '{}', icon: Search, inputSchema: undefined as unknown as Record<string, unknown> },
  ];
  const setSelected = vi.fn();
  const view = render(<McpToolsList toolsList={tools} selectedToolId="seomi_audit_url" setSelectedToolId={setSelected} discovery={{ serverName: 'fixture', serverVersion: '1', tools: [] }} />);
  expect(screen.getByText('mcp.inputSchema')).toBeTruthy();
  expect(screen.getByText('mcp.localToolNotice')).toBeTruthy();
  const card = screen.getAllByText('audit')[0].closest('[role="button"]')!;
  fireEvent.click(card); fireEvent.keyDown(card, { key: 'Enter' }); fireEvent.keyDown(card, { key: ' ' }); fireEvent.keyDown(card, { key: 'Escape' });
  expect(setSelected).toHaveBeenCalledTimes(3);
  view.rerender(<McpToolsList toolsList={tools} selectedToolId="seomi_gsc_search_analytics" setSelectedToolId={setSelected} discovery={null} />);
  expect(screen.getByText('mcp.gscToolNotice')).toBeTruthy();
  view.rerender(<McpToolsList toolsList={tools} selectedToolId="other" setSelectedToolId={setSelected} discovery={{ serverName: 'fixture', serverVersion: '1', tools: [] }} />);
  expect(screen.getByText('mcp.dataforseoToolNotice')).toBeTruthy();
  expect(screen.getAllByText('{}').some(element => element.tagName === 'PRE')).toBe(true);
});
