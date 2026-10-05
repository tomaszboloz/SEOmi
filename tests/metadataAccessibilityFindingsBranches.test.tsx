import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n';
import { MetadataAccessibilityFindings } from '@/components/Results/metadata/MetadataAccessibilityFindings';
import type { PageAuditData } from '@/types';

const { copyMock } = vi.hoisted(() => ({ copyMock: vi.fn() }));
vi.mock('@/services/clipboard', () => ({ copyText: copyMock }));
vi.mock('@/components/Results/ShowOnPageButton', () => ({
  ShowOnPageButton: (p: { selector: string; label: string; domIndex: number }) => <i data-testid="show" data-selector={p.selector} data-index={p.domIndex}>{p.label}</i>,
}));

const el = (n: number, extra: object = {}) => ({ dom_position: n, dom_query: `q${n}`, html_snippet: `<x${n}>`, ...extra });
const finding = (code: string, over: object = {}) => ({ code, severity: 'warning', message: 'Found 3 here', evidence: 'ev: val', recommendation: 'rec', elements: [el(1, { line: 4, column: 2 })], ...over });
const auditWith = (findings: unknown[] | undefined, acc: object = {}): PageAuditData => ({ url: 'https://u.test/', final_url: 'https://f.test/', accessibility: { findings, ...acc } } as unknown as PageAuditData);
const show = () => screen.getAllByTestId('show').map((n) => n.getAttribute('data-selector'));

describe('MetadataAccessibilityFindings', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); copyMock.mockReset(); });

  it('renders nothing without findings', () => {
    expect(render(<MetadataAccessibilityFindings audit={auditWith(undefined)} />).container.innerHTML).toBe('');
    expect(render(<MetadataAccessibilityFindings audit={auditWith([])} />).container.innerHTML).toBe('');
  });

  it.each([
    ['accessibility-focusable-aria-hidden', "a[href], button"], ['accessibility-interactive-name-missing', "a[href], button, input[type='button']"],
    ['accessibility-image-alt-missing', 'img:not([alt])'], ['accessibility-duplicate-id', '[id]'], ['accessibility-aria-reference-unresolved', '[aria-labelledby]'],
    ['accessibility-document-language-invalid', 'html'], ['accessibility-multiple-main-landmarks', "main, [role='main']"], ['accessibility-form-controls-unlabeled', 'input, select, textarea'],
    ['accessibility-other', 'input, select, textarea'],
  ])('uses the right locator selector for %s', (code, selector) => {
    render(<MetadataAccessibilityFindings audit={auditWith([finding(code)])} />);
    expect(show()[0]).toContain(selector);
    expect(screen.getByTestId('show').getAttribute('data-index')).toBe('0');
  });

  it('labels evidence per finding type and renders source info', () => {
    const { rerender } = render(<MetadataAccessibilityFindings audit={auditWith([finding('accessibility-image-alt-missing', { severity: 'error' })])} />);
    expect(screen.getByTestId('show').textContent).toBe(`${i18n.t('accessibility.image')} #1`);
    expect(screen.getByText(i18n.t('ampUi.severity.error')).className).toContain('rose');
    expect(screen.getByText(/q1/)).toBeTruthy();
    rerender(<MetadataAccessibilityFindings audit={auditWith([finding('accessibility-form-controls-unlabeled', { severity: 'info', elements: [el(2)] })], { unlabeled_form_control_count: 9 })} />);
    expect(screen.getByTestId('show').textContent).toBe(`${i18n.t('accessibility.formControl')} #2`);
    expect(screen.getByText(i18n.t('accessibility.shownCount', { shown: 1, total: 9 }))).toBeTruthy();
    expect(screen.getByText(i18n.t('ampUi.severity.info')).className).toContain('sky');
  });

  it('flags the 50 element cap and hides the element list when none', () => {
    const many = Array.from({ length: 50 }, (_, i) => el(i + 1));
    const { rerender } = render(<MetadataAccessibilityFindings audit={auditWith([finding('accessibility-duplicate-id', { elements: many })])} />);
    expect(screen.getByText(i18n.t('accessibility.shownMax'))).toBeTruthy();
    rerender(<MetadataAccessibilityFindings audit={auditWith([finding('accessibility-duplicate-id', { elements: undefined })])} />);
    expect(screen.queryByText(i18n.t('accessibility.locatorDescription'))).toBeNull();
  });

  it('copies evidence only when the clipboard succeeds', async () => {
    copyMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<MetadataAccessibilityFindings audit={auditWith([finding('accessibility-duplicate-id')])} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    await waitFor(() => expect(copyMock).toHaveBeenCalledWith('q1\n<x1>'));
    expect(screen.queryByText(i18n.t('accessibility.copiedEvidence'))).toBeNull();
    fireEvent.click(button);
    expect(await screen.findByText(i18n.t('accessibility.copiedEvidence'))).toBeTruthy();
  });
});
