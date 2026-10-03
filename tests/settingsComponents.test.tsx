import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k })
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: vi.fn((selector) => {
    const mockStore = {
      theme: 'dark',
      setTheme: vi.fn(),
      config: { request_timeout_secs: 30, max_redirects: 5, default_user_agent: 'chrome_mac', verify_ssl: true },
      updateConfig: vi.fn(),
      language: 'en',
      setLanguage: vi.fn(),
      secureStorageError: null,
      isSaving: false
    };
    return selector(mockStore);
  })
}));

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: vi.fn((selector) => {
    const mockStore = { activeProjectId: 'proj-1' };
    return selector(mockStore);
  })
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const mockStore = { apiKeys: { openai: '', claude: '', gemini: '' } };
    return selector(mockStore);
  })
}));

vi.mock('@/services/tauri', () => ({
  isTauriEnvironment: () => true
}));

vi.mock('@/components/Settings/RenderWorkerPanel', () => ({
  RenderWorkerPanel: () => <div data-testid="render-worker-panel" />
}));

// The budget section has its own tests and needs the real i18n instance.
vi.mock('@/components/DataForSEO/cost/DataForSeoBudgetSettings', () => ({ DataForSeoBudgetSettings: () => <div data-testid="dataforseo-budget" /> }));

vi.mock('@/i18n', () => ({
  LANGUAGES: [
    { code: 'en', name: 'English Name', nativeName: 'English Native' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski' }
  ]
}));

import { SettingsTabBar } from '@/components/Settings/settings/SettingsTabBar';
import { GeneralSettingsTab } from '@/components/Settings/settings/GeneralSettingsTab';
import { ApiSettingsTab } from '@/components/Settings/settings/ApiSettingsTab';
import { LanguageSettingsTab } from '@/components/Settings/settings/LanguageSettingsTab';
import { WorkspaceSettingsTab } from '@/components/Settings/settings/WorkspaceSettingsTab';

describe('Settings Components', () => {
  it('SettingsTabBar renders all 5 tabs', () => {
    render(<SettingsTabBar activeTab="general" setActiveTab={vi.fn()} />);
    expect(screen.getByText('settings.general')).toBeTruthy();
    expect(screen.getByText('settings.apiConfig')).toBeTruthy();
    expect(screen.getByText('legacyUi.settings.workspace')).toBeTruthy();
    expect(screen.getByText('settings.language')).toBeTruthy();
    expect(screen.getByText('settings.updates')).toBeTruthy();
  });

  it('GeneralSettingsTab renders theme buttons', () => {
    render(
      <GeneralSettingsTab
        auditNotificationsEnabled={false}
        notificationStatus={null}
        handleAuditNotificationsChange={vi.fn()}
      />
    );
    expect(screen.getByText('settings.theme')).toBeTruthy();
    expect(screen.getByText('settings.dark')).toBeTruthy();
    expect(screen.getByText('settings.light')).toBeTruthy();
    expect(screen.getByText('settings.system')).toBeTruthy();
    expect(screen.getByTestId('render-worker-panel')).toBeTruthy();
  });

  it('ApiSettingsTab renders DataForSEO fields', () => {
    render(
      <ApiSettingsTab
        dataforseoLogin="test-login"
        setDataforseoLogin={vi.fn()}
        dataforseoPass="test-pass"
        setDataforseoPass={vi.fn()}
        testingDataForSeo={false}
        dataForSeoTestStatus={null}
        handleTestDataForSeo={vi.fn()}
        googleMetricsKey=""
        setGoogleMetricsKey={vi.fn()}
        handleAiKeyChange={vi.fn()}
        handleSaveGeneral={vi.fn()}
        savedSuccess={false}
      />
    );
    expect(screen.getByDisplayValue('test-login')).toBeTruthy();
    expect(screen.getByDisplayValue('test-pass')).toBeTruthy();
    expect(screen.getByText('dataforseo.title')).toBeTruthy();
    expect(screen.getByText('legacyUi.settings.pagespeed')).toBeTruthy();
  });

  it('LanguageSettingsTab renders language options', () => {
    render(<LanguageSettingsTab />);
    expect(screen.getByText('English Native')).toBeTruthy();
    expect(screen.getByText('Polski')).toBeTruthy();
  });

  it('WorkspaceSettingsTab renders export/import buttons', () => {
    const mockProject = { id: 'proj-1', name: 'Test Project', rootUrl: 'https://test.com', createdAt: Date.now(), lastAccessedAt: Date.now() };
    const mockRef = { current: null };
    render(
      <WorkspaceSettingsTab
        activeProject={mockProject as any}
        backupStatus={null}
        backupFileInput={mockRef as any}
        handleExportProject={vi.fn()}
        handleImportProject={vi.fn()}
      />
    );
    expect(screen.getByText('legacyUi.settings.backupExport')).toBeTruthy();
    expect(screen.getByText('legacyUi.settings.backupImport')).toBeTruthy();
  });
});
