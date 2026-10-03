import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { saveTextFile } from '@/services/tauri';
import { downloadRenderedArtifact } from '@/components/Domain/crawlResults/crawlResultsHelpers';
import { SettingsModal } from '@/components/Settings/SettingsModal';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import i18n from '@/i18n';

const previousProjects = useProjectStore.getState();
const previousSettings = useSettingsStore.getState();
beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:blocked-export');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('download blocked'); });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.querySelectorAll('a[download]').forEach(anchor => anchor.remove());
  useProjectStore.setState(previousProjects);
  useSettingsStore.setState(previousSettings);
});

it('cleans up a blocked browser MCP configuration download and propagates the failure', async () => {
  vi.useFakeTimers();
  await expect(saveTextFile({defaultPath:'seomi-mcp.json',contents:'{}',extension:'json',filterName:'JSON'})).rejects.toThrow('download blocked');
  expect(document.querySelector('a[download]')).toBeNull();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:blocked-export');
});

it('cleans up a blocked rendered artifact download without changing its bytes or MIME type', () => {
  vi.useFakeTimers();
  expect(() => downloadRenderedArtifact({dataBase64:btoa('PNG fixture'),contentType:'image/png',fileName:'page.png'} as never)).toThrow('download blocked');
  expect(document.querySelector('a[download]')).toBeNull();
  expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toMatchObject({type:'image/png',size:11});
  vi.runAllTimers();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:blocked-export');
});

it('reports a blocked project backup as an error and releases its download resources', async () => {
  const project={id:'backup-fixture',name:'Backup fixture',rootUrl:'https://example.com',createdAt:'2026-10-01',lastOpenedAt:'2026-10-01'};
  useProjectStore.setState({projects:[project],activeProjectId:project.id});
  useSettingsStore.setState({loadDataForSeoCredentials:vi.fn().mockResolvedValue(undefined),loadGoogleMetricsApiKey:vi.fn().mockResolvedValue(undefined)});
  await act(async () => { render(<SettingsModal />); });
  fireEvent.click(screen.getByRole('button',{name:i18n.t('legacyUi.settings.workspace')}));
  fireEvent.click(screen.getByRole('button',{name:i18n.t('legacyUi.settings.backupExport')}));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('download blocked'));
  expect(document.querySelector('a[download]')).toBeNull();
  await act(async () => { await new Promise(resolve => setTimeout(resolve,10)); });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:blocked-export');
});
