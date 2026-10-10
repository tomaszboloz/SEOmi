import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsModal } from '@/components/Settings/SettingsModal';

const mocks = vi.hoisted(() => ({
  closeModal: vi.fn(),
  settings: { configError: 'fixture configuration failure' as string | null },
}));
vi.mock('@/stores/uiStore', () => ({ useUIStore: (select: (state: typeof mocks) => unknown) => select(mocks) }));
vi.mock('@/stores/settingsStore', () => ({ useSettingsStore: (select: (state: typeof mocks.settings) => unknown) => select(mocks.settings) }));
vi.mock('@/hooks/useModalA11y', () => ({ useModalA11y: () => ({ current: null }) }));
vi.mock('@/components/Settings/settings/settingsHandlers', () => ({ useSettingsHandlers: () => ({}) }));
vi.mock('@/components/Settings/settings/SettingsHeader', () => ({ SettingsHeader: () => null }));
vi.mock('@/components/Settings/settings/GeneralSettingsTab', () => ({ GeneralSettingsTab: () => <div data-testid="general" /> }));
vi.mock('@/components/Settings/settings/ApiSettingsTab', () => ({ ApiSettingsTab: () => <div data-testid="api" /> }));
vi.mock('@/components/Settings/settings/LanguageSettingsTab', () => ({ LanguageSettingsTab: () => <div data-testid="language" /> }));
vi.mock('@/components/Settings/settings/WorkspaceSettingsTab', () => ({ WorkspaceSettingsTab: () => <div data-testid="workspace" /> }));
vi.mock('@/components/Settings/settings/UpdatesSettingsTab', () => ({ UpdatesSettingsTab: () => <div data-testid="updates" /> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => { mocks.closeModal.mockClear(); mocks.settings.configError = 'fixture configuration failure'; });

describe('SettingsModal direct branches', () => {
  it('closes only from the backdrop and renders every tab panel', () => {
    const view = render(<SettingsModal />);
    const overlay = screen.getByRole('presentation');
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(mocks.closeModal).not.toHaveBeenCalled();
    fireEvent.mouseDown(overlay);
    expect(mocks.closeModal).toHaveBeenCalledOnce();
    expect(screen.getByTestId('general')).toBeTruthy();
    const tabs = screen.getAllByRole('button');
    for (const [index, panel] of ['api', 'workspace', 'language', 'updates'].entries()) {
      fireEvent.click(tabs[index + 1]);
      expect(screen.getByTestId(panel)).toBeTruthy();
    }
    expect(screen.getByRole('alert').textContent).toContain('fixture configuration failure');
    mocks.settings.configError = null;
    view.rerender(<SettingsModal />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
