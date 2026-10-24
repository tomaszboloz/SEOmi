import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { cmsTransport } from '@/services/cmsPatch/transport';
import { CmsError, type CmsRequest } from '@/services/cmsPatch/types';
import { cmsPanelError, saveCmsBackup } from '@/components/Settings/cms/cmsPanelState';
import { target } from './fixtures/cmsMock';

const { invoke, desktop } = vi.hoisted(() => ({ invoke: vi.fn(), desktop: { value: true } }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke, isTauriEnvironment: () => desktop.value }));
const request: CmsRequest = { method: 'GET', url: 'https://cms.example.com', headers: {},
  credential: 'cms_auth_demo', followRedirects: false, timeoutMs: 15_000 };
beforeEach(async () => { await i18n.changeLanguage('en'); invoke.mockReset(); desktop.value = true; });

it('sends validated requests only over the native transport', async () => {
  invoke.mockResolvedValueOnce({ status: 200, headers: {}, body: '{}' });
  expect(await cmsTransport(request)).toEqual({ status: 200, headers: {}, body: '{}' });
  expect(invoke).toHaveBeenCalledExactlyOnceWith('cms_patch_request', { request });
});

it('refuses browser previews and translates their explicit desktop-only message', async () => {
  desktop.value = false;
  await expect(cmsTransport(request)).rejects.toThrow('cmsPanelUi.desktopOnly');
  expect(cmsPanelError(new Error('cmsPanelUi.desktopOnly'))).toBe('CMS requests are available only in the desktop app.');
  expect(invoke).not.toHaveBeenCalled();
});

it('refuses unsafe transport addresses and surfaces native errors', async () => {
  await expect(cmsTransport({ ...request, url: 'http://localhost' })).rejects.toMatchObject({ code: 'unsafe-url' });
  expect(invoke).not.toHaveBeenCalled();
  invoke.mockRejectedValueOnce('native unavailable');
  await expect(cmsTransport(request)).rejects.toBe('native unavailable');
});

it.each(['unsafe-url', 'conflict', 'http', 'bad-response', 'heading-not-found', 'heading-ambiguous',
  'forbidden', 'not-approved', 'fact-gate-required'] as const)('reuses the existing %s message', (code) => {
  expect(cmsPanelError(new CmsError(code, 'private diagnostic'))).toBe(i18n.t(`cmsUi.error.${code}`));
});

it.each([new Error('offline'), 'offline'])('formats unknown failures: %s', (reason) => {
  expect(cmsPanelError(reason)).toBe('CMS patch failed: offline');
});

it('persists backup bytes using project-scoped crypto-shreddable storage', async () => {
  const backup = { target: target('wordpress'), content: '<p>original</p>', revision: 'r1', at: '2026-10-24' };
  await saveCmsBackup('project-one', backup);
  expect(invoke).toHaveBeenCalledExactlyOnceWith('store_put_record', { projectId: 'project-one', kind: 'cms-patch-backup',
    key: 'wordpress:7:r1', subjectId: 'cms-patch-backup', data: Array.from(new TextEncoder().encode(JSON.stringify(backup))) });
});
