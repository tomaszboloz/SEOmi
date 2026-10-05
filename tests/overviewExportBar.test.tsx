import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewExportBar } from '@/components/Results/overview/OverviewExportBar';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

const { json, csv, pdf } = vi.hoisted(() => ({ json: vi.fn(), csv: vi.fn(), pdf: vi.fn() }));
vi.mock('@/services/export', () => ({
  downloadAuditJson: json,
  downloadAuditCsv: csv,
  downloadAuditPdf: pdf,
}));

const audit = createAuditFixture();

describe('OverviewExportBar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    json.mockReset();
    csv.mockReset();
    pdf.mockReset().mockResolvedValue(undefined);
  });

  it('exports JSON and CSV for the given audit', () => {
    render(<OverviewExportBar audit={audit} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('overview.exportJson') }));
    expect(json).toHaveBeenCalledWith(audit);
    expect(csv).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('overview.exportCsv') }));
    expect(csv).toHaveBeenCalledWith(audit);
    expect(screen.queryByText(i18n.t('legacyUi.overview.pdfError'))).toBeNull();
  });

  it('exports PDF without showing an error on success', async () => {
    render(<OverviewExportBar audit={audit} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('overview.exportPdf') }));
    await waitFor(() => expect(pdf).toHaveBeenCalledWith(audit));
    expect(screen.queryByText(/./, { selector: '.text-rose-300' })).toBeNull();
  });

  it('shows the Error message when PDF export fails and clears it on retry', async () => {
    pdf.mockRejectedValueOnce(new Error('render exploded'));
    render(<OverviewExportBar audit={audit} />);
    const button = screen.getByRole('button', { name: i18n.t('overview.exportPdf') });
    fireEvent.click(button);
    expect(await screen.findByText('render exploded')).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByText('render exploded')).toBeNull());
  });

  it('falls back to the translated message for non-Error failures', async () => {
    pdf.mockRejectedValueOnce('weird');
    render(<OverviewExportBar audit={audit} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('overview.exportPdf') }));
    expect(await screen.findByText(i18n.t('legacyUi.overview.pdfError'))).toBeTruthy();
  });
});
