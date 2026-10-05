import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { MetadataAccessibilityHidden } from '@/components/Results/metadata/MetadataAccessibilityHidden';
import type { PageAuditData } from '@/types';

vi.mock('@/components/Results/ShowOnPageButton', () => ({
  ShowOnPageButton: (p: { url: string; label: string; domIndex: number }) => <i data-testid="show" data-url={p.url} data-index={p.domIndex}>{p.label}</i>,
}));

const el = (n: number, extra: object = {}) => ({ dom_position: n, dom_query: `q${n}`, html_snippet: `<x${n}>`, ...extra });
const audit = (acc: object | undefined, over: object = {}) => ({ url: 'https://u.test/', accessibility: acc, ...over }) as unknown as PageAuditData;

describe('MetadataAccessibilityHidden', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('renders nothing for missing or zero counts', () => {
    expect(render(<MetadataAccessibilityHidden audit={audit(undefined)} />).container.innerHTML).toBe('');
    expect(render(<MetadataAccessibilityHidden audit={audit({ hidden_form_control_count: 0, anti_spam_text_control_count: 0 })} />).container.innerHTML).toBe('');
  });

  it('lists hidden controls with source info and a truncation notice', () => {
    render(<MetadataAccessibilityHidden audit={audit({ hidden_form_control_count: 5, hidden_form_controls: [el(1, { line: 7, column: 3 }), el(2, { line: 9 }), el(3)] }, { final_url: 'https://f.test/' })} />);
    expect(screen.getByText(i18n.t('accessibility.hiddenTitle', { count: 5 }))).toBeTruthy();
    expect(screen.getByText(i18n.t('accessibility.hiddenDescription'))).toBeTruthy();
    expect(screen.getByText(new RegExp(i18n.t('accessibility.source', { line: 7, column: 3 }).replace(/[()]/g, '\\$&')))).toBeTruthy();
    expect(screen.getByText(new RegExp(i18n.t('accessibility.source', { line: 9, column: 1 }).replace(/[()]/g, '\\$&')))).toBeTruthy();
    expect(screen.getByText(new RegExp(i18n.t('accessibility.sourceUnavailable')))).toBeTruthy();
    expect(screen.getByText(i18n.t('accessibility.limitFirst', { shown: 3 }))).toBeTruthy();
    const buttons = screen.getAllByTestId('show');
    expect(buttons.map((b) => b.getAttribute('data-index'))).toEqual(['0', '1', '2']);
    expect(buttons[0].getAttribute('data-url')).toBe('https://f.test/');
    expect(buttons[0].textContent).toBe(`${i18n.t('accessibility.hiddenControl')} #1`);
  });

  it('omits the truncation notice when every control is shown and falls back to url', () => {
    render(<MetadataAccessibilityHidden audit={audit({ hidden_form_control_count: 1, hidden_form_controls: [el(1)] })} />);
    expect(screen.queryByText(i18n.t('accessibility.limitFirst', { shown: 1 }))).toBeNull();
    expect(screen.getByTestId('show').getAttribute('data-url')).toBe('https://u.test/');
  });

  it('lists anti-spam text controls and their truncation notice', () => {
    render(<MetadataAccessibilityHidden audit={audit({ anti_spam_text_control_count: 4, anti_spam_text_controls: [el(2), el(3)] })} />);
    expect(screen.getByText(i18n.t('accessibility.antispamTitle', { count: 4 }))).toBeTruthy();
    expect(screen.getByText(i18n.t('accessibility.antispamDescription'))).toBeTruthy();
    expect(screen.getByText(i18n.t('accessibility.limitFirst', { shown: 2 }))).toBeTruthy();
    expect(screen.getAllByTestId('show')[1].textContent).toBe(i18n.t('accessibility.antispamLabel', { position: 3 }));
  });

  it('tolerates a count without the element list', () => {
    render(<MetadataAccessibilityHidden audit={audit({ hidden_form_control_count: 2, anti_spam_text_control_count: 2 })} />);
    expect(screen.queryAllByTestId('show')).toHaveLength(0);
    expect(screen.getAllByText(i18n.t('accessibility.limitFirst', { shown: 0 }))).toHaveLength(2);
  });
});
