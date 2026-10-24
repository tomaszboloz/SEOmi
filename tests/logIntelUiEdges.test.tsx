import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import LogIntelligencePanel from '@/components/Domain/crawlResults/logIntelligence/LogIntelligencePanel';
import { useLogImport } from '@/components/Domain/crawlResults/logIntelligence/useLogImport';
import { readLogState, saveLogState } from '@/services/logIntelligence/storage';
import * as files from '@/services/logIntelligence/browserFile';
import { coveredLogState, logFile, logLine, setupLogCrypto } from './fixtures/logIntel';

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); setupLogCrypto(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const choose = (file: File) => fireEvent.change(screen.getByLabelText('Choose access log'), { target: { files: [file] } });

describe('log import failure and lifecycle branches', () => {
  it.each([['invalidFile', 'access.csv'], ['tooLarge', 'access.log']] as const)('shows %s without reading the file', async (error, name) => {
    const file = logFile('', name);
    if (error === 'tooLarge') Object.defineProperty(file, 'size', { value: files.MAX_LOG_BYTES + 1 });
    const slice = vi.spyOn(file, 'slice');
    render(<LogIntelligencePanel projectId="p1" />);
    choose(file);
    expect((await screen.findByRole('alert')).textContent).toBe(i18n.t(`logIntelUi.${error}`));
    expect(slice).not.toHaveBeenCalled();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('reports read/hash failures and keeps saved aggregates intact', async () => {
    saveLogState('p1', coveredLogState());
    const file = logFile(logLine());
    vi.spyOn(file, 'slice').mockImplementation(() => { throw new Error('unreadable'); });
    render(<LogIntelligencePanel projectId="p1" />);
    choose(file);
    expect((await screen.findByRole('alert')).textContent).toBe(i18n.t('logIntelUi.importFailed'));
    expect(readLogState('p1').lines).toBe(30);
  });
  it('warns when quota prevents saving while retaining the imported state in memory', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    render(<LogIntelligencePanel projectId="p1" />);
    choose(logFile(logLine()));
    expect((await screen.findByRole('alert')).textContent).toBe(i18n.t('logIntelUi.storageFailed'));
    expect(screen.getByRole('status').textContent).toContain('Lines: 1');
    expect(readLogState('p1').lines).toBe(0);
  });
  it('warns when deletion is denied rather than claiming saved logs were cleared', () => {
    saveLogState('p1', coveredLogState());
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    render(<LogIntelligencePanel projectId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear logs' }));
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('logIntelUi.storageFailed'));
    expect(readLogState('p1').lines).toBe(30);
  });
  it('locks concurrent imports and clearing, and cancels during hashing without creating resume data', async () => {
    let release!: (hash: string) => void;
    const hash = vi.spyOn(files, 'hashLogFile').mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const { result } = renderHook(() => useLogImport('p1'));
    let pending!: Promise<void>;
    act(() => { pending = result.current.importFile(logFile(logLine())); });
    act(() => { void result.current.importFile(logFile('other')); result.current.clear(); result.current.cancel(); });
    expect(hash).toHaveBeenCalledTimes(1);
    await act(async () => { release('hash'); await pending; });
    expect(result.current).toMatchObject({ busy: false, message: 'cancelled', state: { lines: 0, inProgress: null } });
  });
  it('ignores hash completion and hash failure after unmount', async () => {
    for (const shouldFail of [false, true]) {
      let release!: () => void;
      vi.spyOn(files, 'hashLogFile').mockImplementation(() => new Promise((resolve, reject) => {
        release = () => shouldFail ? reject(new Error('failed')) : resolve('hash');
      }));
      const { result, unmount } = renderHook(() => useLogImport('p1'));
      let pending!: Promise<void>;
      act(() => { pending = result.current.importFile(logFile(logLine())); });
      unmount();
      release();
      await pending;
      expect(readLogState('p1').lines).toBe(0);
      vi.restoreAllMocks();
    }
  });
  it('persists cancellation to the original project after unmount, without changing another project', async () => {
    let release!: () => void;
    let entered = false;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(files, 'readLogLines').mockImplementation(async function* () {
      yield logLine(); entered = true; await gate; yield logLine('/b');
    });
    const { result, unmount } = renderHook(() => useLogImport('p1'));
    let pending!: Promise<void>;
    act(() => { pending = result.current.importFile(logFile(logLine())); });
    await waitFor(() => expect(entered).toBe(true));
    unmount();
    render(<LogIntelligencePanel key="p2" projectId="p2" />);
    await act(async () => { release(); await pending; });
    expect(readLogState('p1')).toMatchObject({ lines: 1, inProgress: { offset: 1 } });
    expect(screen.getByRole('status').textContent).toContain('Lines: 0');
    expect(readLogState('p2').lines).toBe(0);
  });
  it('allows a completed duplicate while another import is paused, keeping its resume point', async () => {
    const state = coveredLogState();
    state.inProgress = { hash: 'paused', offset: 3 };
    saveLogState('p1', state);
    vi.spyOn(files, 'hashLogFile').mockResolvedValue('saved');
    render(<LogIntelligencePanel projectId="p1" />);
    choose(logFile(logLine()));
    await screen.findByText(/Select the same file to resume/);
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(readLogState('p1')).toEqual(state);
  });
});
