import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { McpServerConfigCard } from '@/components/AgentWorkflows/mcpHub/McpServerConfigCard';
import { getActiveConfigString } from '@/components/AgentWorkflows/mcpHub/mcpHubTypes';

const m = vi.hoisted(() => ({ copy: vi.fn(), save: vi.fn(), tauri: vi.fn(() => true) }));
vi.mock('@/services/clipboard', () => ({ copyText: m.copy }));
vi.mock('@/services/tauri', () => ({ saveTextFile: m.save, isTauriEnvironment: m.tauri }));

type Tab = 'claude' | 'cursor' | 'codex' | 'gemini';
const discoverTools = vi.fn();
const PATH = '/opt/seomi/index.js';
const Harness = ({ path = PATH, discovering = false, error = '' }: { path?: string; discovering?: boolean; error?: string }) => {
  const [tab, setTab] = useState<Tab>('claude');
  const [serverPath, setPath] = useState(path);
  return <McpServerConfigCard mcpClientTab={tab} setMcpClientTab={setTab} serverPath={serverPath} updateServerPath={setPath} discoverTools={discoverTools} discovering={discovering} discoveryError={error} />;
};
const tx = (k: string) => i18n.t(`mcp.${k}`);
const btn = (k: string) => screen.getByRole('button', { name: new RegExp(tx(k)) }) as HTMLButtonElement;

beforeEach(async () => {
  await i18n.changeLanguage('en');
  Object.values(m).forEach((fn) => fn.mockReset());
  m.tauri.mockReturnValue(true);
  discoverTools.mockReset();
});

describe('McpServerConfigCard path validation', () => {
  it.each([['/opt/a.js', true], ['C:\\srv\\a.JS', true], ['\\\\host\\a.js', true], ['relative/a.js', false], ['/opt/a.ts', false], ['  ', false]])('treats %j as absolute .js path: %s', (path, ok) => {
    render(<Harness path={path as string} />);
    expect(btn('copyConfig').disabled).toBe(!ok);
    expect(btn('exportConfig').disabled).toBe(!ok);
    expect(Boolean(screen.queryByText(tx('buildRequired')))).toBe(!ok);
    expect(Boolean(screen.queryByText(tx('configMissing')))).toBe(!ok);
  });

  it('reveals the config after a valid path is typed', () => {
    render(<Harness path="" />);
    fireEvent.change(screen.getByLabelText(tx('serverPathAria')), { target: { value: PATH } });
    expect(screen.getByText(getActiveConfigString('claude', PATH), { normalizer: (s) => s })).toBeTruthy();
  });
});

describe('McpServerConfigCard clients and copy', () => {
  it('switches client tab, instructions and config format', () => {
    render(<Harness />);
    expect(screen.getByText(tx('instructionsClaude'))).toBeTruthy();
    for (const [name, key] of [['clientCursor', 'instructionsCursor'], ['clientCodex', 'instructionsCodex'], ['clientGemini', 'instructionsGemini']]) {
      fireEvent.click(screen.getByRole('button', { name: tx(name) }));
      expect(screen.getByText(tx(key))).toBeTruthy();
    }
    expect(screen.queryByText(tx('instructionsClaude'))).toBeNull();
  });

  it('copies the active config and shows the confirmation only on success', async () => {
    m.copy.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<Harness />);
    fireEvent.click(btn('copyConfig'));
    await waitFor(() => expect(m.copy).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(tx('copied'))).toBeNull();
    fireEvent.click(btn('copyConfig'));
    expect(await screen.findByText(tx('copied'))).toBeTruthy();
    expect(m.copy).toHaveBeenLastCalledWith(getActiveConfigString('claude', PATH));
  });
});

describe('McpServerConfigCard export', () => {
  it('saves a JSON file for JSON clients and a TOML file for Codex', async () => {
    m.save.mockResolvedValue('saved');
    render(<Harness />);
    fireEvent.click(btn('exportConfig'));
    expect(await screen.findByText(tx('exportedConfig'))).toBeTruthy();
    expect(m.save).toHaveBeenLastCalledWith({ defaultPath: 'seomi-mcp-claude.json', contents: getActiveConfigString('claude', PATH), extension: 'json', filterName: tx('jsonFileType') });
    fireEvent.click(screen.getByRole('button', { name: tx('clientCodex') }));
    expect(screen.queryByText(tx('exportedConfig'))).toBeNull();
    fireEvent.click(btn('exportConfig'));
    await waitFor(() => expect(m.save).toHaveBeenCalledTimes(2));
    expect(m.save.mock.calls[1][0]).toMatchObject({ defaultPath: 'seomi-mcp-codex.toml', extension: 'toml', filterName: tx('tomlFileType') });
  });

  it('shows no success or error when the dialog is cancelled', async () => {
    m.save.mockResolvedValue('cancelled');
    render(<Harness />);
    fireEvent.click(btn('exportConfig'));
    await waitFor(() => expect(btn('exportConfig').disabled).toBe(false));
    expect(screen.queryByText(tx('exportedConfig'))).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reports a failed export, clears it on a client switch, and disables during export', async () => {
    let fail!: (e: Error) => void;
    m.save.mockReturnValueOnce(new Promise((_, rej) => { fail = rej; }));
    render(<Harness />);
    fireEvent.click(btn('exportConfig'));
    expect(btn('exportingConfig').disabled).toBe(true);
    fail(new Error('disk'));
    expect((await screen.findByRole('alert')).textContent).toBe(tx('exportError'));
    fireEvent.click(screen.getByRole('button', { name: tx('clientCursor') }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('McpServerConfigCard discovery', () => {
  it('discovers tools only on the desktop with a valid path', () => {
    render(<Harness />);
    fireEvent.click(btn('discover'));
    expect(discoverTools).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(tx('desktopRequired'))).toBeNull();
  });

  it('disables discovery in the browser, while discovering, and shows the error', () => {
    m.tauri.mockReturnValue(false);
    const { unmount } = render(<Harness error="spawn failed" />);
    expect(btn('discover').disabled).toBe(true);
    expect(screen.getByText(tx('desktopRequired'))).toBeTruthy();
    expect(screen.getByText(/spawn failed/).textContent).toContain(tx('discoveryError'));
    unmount();
    m.tauri.mockReturnValue(true);
    render(<Harness discovering />);
    expect(btn('discovering').disabled).toBe(true);
  });
});

describe('McpServerConfigCard placeholder', () => {
  it('suggests a Windows or a macOS path depending on the platform', () => {
    const spy = vi.spyOn(navigator, 'platform', 'get');
    spy.mockReturnValue('Win32');
    const { unmount } = render(<Harness />);
    expect(screen.getByLabelText(tx('serverPathAria')).getAttribute('placeholder')).toBe(tx('serverPathWindows'));
    unmount();
    spy.mockReturnValue('MacIntel');
    render(<Harness />);
    expect(screen.getByLabelText(tx('serverPathAria')).getAttribute('placeholder')).toBe(tx('serverPathMac'));
    spy.mockRestore();
  });
});
