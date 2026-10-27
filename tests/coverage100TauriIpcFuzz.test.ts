import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri/transport';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

afterEach(() => {
  vi.mocked(invoke).mockReset();
});

describe('coverage100TauriIpcFuzz', () => {
  it.each([
    '',
    '__proto__',
    'constructor',
    'toString',
    'hasOwnProperty',
  ])('rejects the prototype-like command name %j as unknown instead of resolving an inherited member', async (command) => {
    expect(isTauriEnvironment()).toBe(false);
    await expect(invokeTauriCommand(command)).rejects.toThrow(`Unknown desktop command: ${command}`);
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each([
    'GET_CONFIG',
    ' get_config',
    'get_config\u0000',
    'crawl_site ',
    'Has_Secret',
  ])('matches IPC command names exactly, so %j is not routed to a known handler', async (command) => {
    await expect(invokeTauriCommand(command, { key: 'value' })).rejects.toThrow(`Unknown desktop command: ${command}`);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('never forwards to the native bridge while the Tauri internals marker is absent', async () => {
    await expect(invokeTauriCommand('has_secret', { name: 'openai_api_key' })).resolves.toBe(false);
    await expect(invokeTauriCommand('crawl_site', { url: 'https://example.com' })).rejects.toThrow(
      'This action requires the installed macOS or Windows desktop application.',
    );
    expect(invoke).not.toHaveBeenCalled();
  });
});
