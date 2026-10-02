import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { AmpFindings } from '@/components/Results/AmpFindings';
import type { AmpFinding } from '@/types';

beforeEach(async () => { await i18n.changeLanguage('en'); });

it('shows an explicit empty state when no AMP rule fired', () => {
  render(<AmpFindings findings={[]} />);
  expect(screen.getByText(i18n.t('ampUi.noFindings'))).toBeTruthy();
});

it('lists every finding with severity, raw evidence and source evidence', () => {
  const findings = [
    { code: 'amp-missing-boilerplate', severity: 'error', message: 'Missing boilerplate', evidence: '<style amp-boilerplate> absent', recommendation: 'Add boilerplate' },
    { code: 'amp-custom-note', severity: 'info', message: 'Custom note', evidence: 'raw <evidence>' },
  ] as AmpFinding[];
  render(<AmpFindings findings={findings} />);
  expect(screen.getByRole('heading').textContent).toBe(i18n.t('ampUi.findings', { count: 2 }));
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByText(i18n.t('ampUi.severity.error'))).toBeTruthy();
  expect(screen.getByText(i18n.t('ampUi.severity.info'))).toBeTruthy();
  expect(screen.getByText('raw <evidence>')).toBeTruthy();
  expect(screen.getAllByText(i18n.t('ampFindings.sourceEvidence'))).toHaveLength(2);
});
