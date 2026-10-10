import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSettingsTab } from '@/components/Settings/settings/LanguageSettingsTab';
import { WorkspaceSettingsTab } from '@/components/Settings/settings/WorkspaceSettingsTab';
import { useSettingsStore } from '@/stores/settingsStore';

describe('Settings tabs interactions', () => {
  beforeEach(() => {
    useSettingsStore.setState({ language: 'en' });
  });

  it('changes language when clicking a language button in LanguageSettingsTab', () => {
    render(<LanguageSettingsTab />);
    const polishButton = screen.getByText('Polski').closest('button')!;
    fireEvent.click(polishButton);
    expect(useSettingsStore.getState().language).toBe('pl');
  });

  it('triggers import file input click in WorkspaceSettingsTab', () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const mockRef = React.createRef<HTMLInputElement>();
    const handleExport = vi.fn();
    const handleImport = vi.fn();

    render(
      <WorkspaceSettingsTab
        activeProject={{ id: 'p1', name: 'Proj', rootUrl: 'https://test.com', createdAt: 0, lastAccessedAt: 0 } as any}
        backupStatus="Backup ready"
        backupFileInput={mockRef}
        handleExportProject={handleExport}
        handleImportProject={handleImport}
      />
    );

    expect(screen.getByRole('status').textContent).toBe('Backup ready');

    const importButton = screen.getByRole('button', { name: /import/i });
    fireEvent.click(importButton);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();

    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);
    expect(handleExport).toHaveBeenCalled();
  });


  it('handles WorkspaceSettingsTab without active project and null ref safely', () => {
    const mockRef = { current: null };
    render(
      <WorkspaceSettingsTab
        activeProject={null}
        backupStatus={null}
        backupFileInput={mockRef}
        handleExportProject={vi.fn()}
        handleImportProject={vi.fn()}
      />
    );

    const importButton = screen.getByRole('button', { name: /import/i });
    expect(() => fireEvent.click(importButton)).not.toThrow();
  });

});
