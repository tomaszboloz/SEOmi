import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { captureRenderedArtifact, getRenderWorkerStatus, saveTextFile, startRenderWorker, stopRenderWorker } from '@/services/tauri';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

vi.mock('@tauri-apps/api/core', () => ({invoke:vi.fn()}));
vi.mock('@tauri-apps/plugin-dialog', () => ({save:vi.fn()}));
beforeEach(() => {Object.defineProperty(window,'__TAURI_INTERNALS__',{configurable:true,value:{}});});
afterEach(() => {Reflect.deleteProperty(window,'__TAURI_INTERNALS__');vi.resetAllMocks();});
const options={defaultPath:'seomi-mcp.json',contents:'{"servers":{}}',extension:'json' as const,filterName:'JSON'};

it('saves MCP configuration only to the path selected in the native dialog', async () => {
  vi.mocked(save).mockResolvedValue('C:\\exports\\seomi-mcp.json');
  vi.mocked(invoke).mockResolvedValue(undefined);
  await expect(saveTextFile(options)).resolves.toBe('saved');
  expect(save).toHaveBeenCalledWith({defaultPath:options.defaultPath,filters:[{name:'JSON',extensions:['json']}]});
  expect(invoke).toHaveBeenCalledWith('write_mcp_config_file',{path:'C:\\exports\\seomi-mcp.json',contents:options.contents});
});
it('does not write a file when the native dialog is cancelled', async () => {
  vi.mocked(save).mockResolvedValue(null);
  await expect(saveTextFile(options)).resolves.toBe('cancelled');
  expect(invoke).not.toHaveBeenCalled();
});
it('propagates native filesystem failures without reporting a successful save', async () => {
  vi.mocked(save).mockResolvedValue('/exports/config.toml');
  vi.mocked(invoke).mockRejectedValue(new Error('permission denied'));
  await expect(saveTextFile({...options,extension:'toml'})).rejects.toThrow('permission denied');
});
it('forwards rendered capture defaults and returns only the native artifact', async () => {
  const artifact={fileName:'page.png',contentType:'image/png',dataBase64:'fixture'};
  vi.mocked(invoke).mockResolvedValue(artifact);
  await expect(captureRenderedArtifact({url:'https://example.com',allowSubdomains:false,kind:'screenshot'})).resolves.toBe(artifact);
  expect(invoke).toHaveBeenCalledWith('capture_rendered_artifact',{url:'https://example.com',allowSubdomains:false,kind:'screenshot',scopePath:null,waitForSelector:null,waitDelayMs:0,lazyScrollCycles:0,runId:null});
});
it('preserves explicit rendered capture options and propagates a native rejection', async () => {
  vi.mocked(invoke).mockRejectedValue(new Error('scope rejected'));
  await expect(captureRenderedArtifact({url:'https://example.com/docs',allowSubdomains:true,kind:'pdf',scopePath:'/docs',waitForSelector:'main',waitDelayMs:250,lazyScrollCycles:3,runId:'run-fixture'})).rejects.toThrow('scope rejected');
  expect(invoke).toHaveBeenCalledWith('capture_rendered_artifact',expect.objectContaining({scopePath:'/docs',waitForSelector:'main',waitDelayMs:250,lazyScrollCycles:3,runId:'run-fixture'}));
});
it('returns the native renderer lease/status and explicitly stops the worker', async () => {
  const lease={baseUrl:'http://127.0.0.1:12345',token:'fixture',version:'1',expiresAt:'2026-10-01',oneShot:true};
  vi.mocked(invoke).mockResolvedValueOnce(lease).mockResolvedValueOnce(true).mockResolvedValueOnce(undefined);
  await expect(startRenderWorker()).resolves.toBe(lease);
  await expect(getRenderWorkerStatus()).resolves.toBe(true);
  await expect(stopRenderWorker()).resolves.toBeUndefined();
  expect(vi.mocked(invoke).mock.calls.map(call=>call[0])).toEqual(['start_render_worker','render_worker_status','stop_render_worker']);
});
it('propagates renderer lifecycle failures instead of fabricating a lease or running status', async () => {
  vi.mocked(invoke).mockRejectedValue(new Error('worker unavailable'));
  await expect(startRenderWorker()).rejects.toThrow('worker unavailable');
  await expect(getRenderWorkerStatus()).rejects.toThrow('worker unavailable');
  await expect(stopRenderWorker()).rejects.toThrow('worker unavailable');
});
