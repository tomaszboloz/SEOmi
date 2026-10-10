import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverviewIssueItem } from '@/components/Results/overview/OverviewIssueItem';
import type { Issue } from '@/types';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

vi.mock('@/components/Results/ShowOnPageButton', () => ({
  ShowOnPageButton: (props: { url: string; selector: string; domIndex: number; label: string }) => (
    <button data-url={props.url} data-selector={props.selector} data-index={props.domIndex}>{props.label}</button>
  ),
}));
const issue = (code: string, message = 'Observed finding'): Issue => ({
  severity: 'Warning', category: 'Technical', code, message,
});
const audit = (code: string, line?: number, column?: number) => createAuditFixture({
  final_url: '', accessibility: {
    document_language: 'en', landmarks: [], aria_attribute_count: 0,
    form_control_count: 1, unlabeled_form_control_count: 1, manual_review_items: [],
    findings: [{ code, severity: 'warning', message: 'Observed', evidence: 'Input', recommendation: 'Add label', elements: [{
      dom_position: 3, dom_query: 'input:nth-child(3)', html_snippet: '<input>', line, column,
    }] }],
  },
});

describe('overview issue evidence source boundaries', () => {
  it.each(['accessibility-form-controls-unlabeled', 'accessibility-antispam-control-not-text'])(
    'uses DOM order and default source column for %s', (code) => {
      const observed = audit(code, 12);
      render(<OverviewIssueItem issue={issue(code)} audit={observed} />);
      expect(screen.getByText('input:nth-child(3)')).toBeTruthy();
      expect(screen.getByText('<input>')).toBeTruthy();
      expect(screen.getByText(/12:1/).textContent).toContain(i18n.t('accessibility.domOrder'));
      const button = screen.getByRole('button');
      expect(button.getAttribute('data-url')).toBe(observed.url);
      expect(button.getAttribute('data-index')).toBe('2');
      expect(button.getAttribute('data-selector')).toBe('input, select, textarea');
    },
  );
  it('matches a legacy message code and exposes unavailable source location', () => {
    const code = 'accessibility-image-alt-missing';
    render(<OverviewIssueItem issue={issue('legacy', `Observed ${code}`)} audit={audit(code)} />);
    expect(screen.getByText(i18n.t('accessibility.sourceUnavailable'), { exact: false })).toBeTruthy();
    expect(screen.getByText(i18n.t('accessibility.selectorOrder'), { exact: false })).toBeTruthy();
    expect(screen.getByRole('button').getAttribute('data-selector')).toBe('img:not([alt])');
  });
  it('preserves explicit source columns and the final URL', () => {
    const code = 'accessibility-image-alt-missing';
    const observed = { ...audit(code, 9, 4), final_url: 'https://final.example.test/' };
    render(<OverviewIssueItem issue={issue(code)} audit={observed} />);
    expect(screen.getByText(/9:4/)).toBeTruthy();
    expect(screen.getByRole('button').getAttribute('data-url')).toBe(observed.final_url);
  });
  it('omits locations when a finding has no element evidence', () => {
    const observed = audit('different');
    observed.accessibility!.findings![0].elements = undefined;
    const view = render(<OverviewIssueItem issue={issue('different')} audit={observed} />);
    expect(view.container.querySelector('details')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
