import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { URLInputActions } from '@/components/URLBar/urlInput/URLInputActions';
import { useAuditStore } from '@/stores/auditStore';
import i18n from '@/i18n';

vi.mock('@/components/URLBar/UserAgentSelector', () => ({ UserAgentSelector: () => <span>User agent</span> }));
const importer = vi.fn();
beforeEach(() => { importer.mockReset(); useAuditStore.setState({ isBatchRunning: false, importAuditCsv: importer }); });

describe('direct URL action controls', () => {
  it('imports actual file text, resets the picker, and ignores an empty file event', async () => {
    const view = render(<URLInputActions url="https://example.test" isLoading={false} hasCurrentAudit={false} onReAudit={vi.fn()} />);
    const picker = screen.getByLabelText(i18n.t('legacyUi.url.csvImportAria')) as HTMLInputElement;
    const click = vi.spyOn(picker, 'click');
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.url.csvImportTitle')));
    expect(click).toHaveBeenCalledOnce();
    expect(picker.accept).toBe('.csv,text/csv');
    fireEvent.change(picker, { target: { files: [] } });
    expect(importer).not.toHaveBeenCalled();
    const file = new File(['url\nhttps://example.test'], 'urls.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: vi.fn().mockResolvedValue('url\nhttps://example.test') });
    fireEvent.change(picker, { target: { files: [file] } });
    await waitFor(() => expect(importer).toHaveBeenCalledWith('url\nhttps://example.test'));
    expect(picker.value).toBe('');
    expect(view.container.querySelector('[type="submit"]')).toBeTruthy();
  });
  it('guards empty/busy actions and dispatches re-audit only when enabled', () => {
    const rerun = vi.fn();
    const view = render(<URLInputActions url=" " isLoading={false} hasCurrentAudit onReAudit={rerun} />);
    expect((screen.getByRole('button', { name: i18n.t('urlBar.analyze') }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.url.reauditTitle')));
    expect(rerun).toHaveBeenCalledOnce();
    useAuditStore.setState({ isBatchRunning: true });
    view.rerender(<URLInputActions url="https://example.test" isLoading hasCurrentAudit onReAudit={rerun} />);
    expect((screen.getByTitle(i18n.t('legacyUi.url.csvImportTitle')) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(i18n.t('urlBar.analyzing'))).toBeTruthy();
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.url.reauditTitle')));
    expect(rerun).toHaveBeenCalledOnce();
    view.rerender(<URLInputActions url="https://example.test" isLoading={false} hasCurrentAudit={false} onReAudit={rerun} />);
    expect(screen.queryByTitle(i18n.t('legacyUi.url.reauditTitle'))).toBeNull();
  });
});
