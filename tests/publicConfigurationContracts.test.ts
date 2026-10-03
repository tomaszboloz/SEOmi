import { describe, expect, it } from 'vitest';
import { getClaudeConfig, getCodexConfig, getCursorConfig, getGeminiConfig, getActiveConfigString } from '@/components/AgentWorkflows/mcpHub/mcpHubTypes';
import { getLevelBadgeClass, keyphraseStorageKey } from '@/components/Results/headingsTree/headingsTreeTypes';
import { formatQueueWakeupError } from '@/stores/audit/auditHelpers';
import i18n from '@/i18n';

describe('public configuration and presentation contracts', () => {
  it('keeps local paths as single arguments for each subscription client', () => {
    const path = '  C:\\SEO mi\\server "copy".js  ';
    const args = ['C:\\SEO mi\\server "copy".js'];
    expect(getClaudeConfig(path)).toEqual({ mcpServers: { seomi: { command: 'node', args } } });
    expect(getGeminiConfig(path)).toEqual({ mcpServers: { seomi: { command: 'node', args } } });
    expect(getCursorConfig(path)).toEqual({ mcpServers: { 'seomi-assistant': { type: 'stdio', command: 'node', args } } });
    expect(getCodexConfig(' /tmp/SEO mi/server.js ')).toBe('[mcp_servers.seomi]\ncommand = "node"\nargs = ["/tmp/SEO mi/server.js"]');
    for (const client of ['claude', 'cursor', 'gemini']) {
      const parsed = JSON.parse(getActiveConfigString(client, path));
      const server = parsed.mcpServers[client === 'cursor' ? 'seomi-assistant' : 'seomi'];
      expect(server.args).toEqual(args);
      expect(server.command).toBe('node');
    }
    expect(getActiveConfigString('unknown', '/tmp/server.js')).toBe(getCodexConfig('/tmp/server.js'));
    expect(getActiveConfigString('codex', '/tmp/server.js')).toBe(getCodexConfig('/tmp/server.js'));
  });

  it.each([[1, 'emerald'], [2, 'blue'], [3, 'purple'], [4, 'amber']] as const)(
    'uses the level %s visual category without conflating hierarchy levels', (level, color) => {
      expect(getLevelBadgeClass(level)).toContain(`text-${color}-400`);
      expect(getLevelBadgeClass(level)).toContain('border-');
    });

  it('uses neutral badges for lower and invalid levels and isolates persisted keyphrases', () => {
    for (const level of [0, 5, 6, 7, Number.NaN]) {
      expect(getLevelBadgeClass(level)).toBe('bg-slate-800 text-slate-400 border-slate-700');
    }
    const target = 'https://example.test/a?b=1#ż';
    expect(keyphraseStorageKey('project-a', target)).toBe('seomi_project_project-a_headings_keyphrase_https%3A%2F%2Fexample.test%2Fa%3Fb%3D1%23%C5%BC_v1');
    expect(keyphraseStorageKey('project-b', target)).not.toBe(keyphraseStorageKey('project-a', target));
  });

  it('formats queue wakeup errors through the localized scheduler message', () => {
    for (const value of [new Error('queue unavailable'), 'queue unavailable', null, 42]) {
      const message = value instanceof Error ? value.message : String(value);
      expect(formatQueueWakeupError(value)).toBe(i18n.t('schedules.schedulerError', { error: message }));
      expect(formatQueueWakeupError(value)).toContain(message);
    }
  });
});
