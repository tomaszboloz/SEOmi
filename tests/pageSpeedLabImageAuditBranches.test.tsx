import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { PageSpeedLabImageAudit } from '@/components/Performance/pagespeed/PageSpeedLabImageAudit';

const t = (k: string, o?: object): string => String(i18n.t(k, o as never));
const audit = (over: object = {}) => ({ id: 'a1', title: 'Audit', score: 1, scoreDisplayMode: 'binary', displayValue: '', description: 'Plain text', overallSavingsBytes: null, evidence: [], evidenceTruncated: false, evidenceCount: 0, ...over });
const show = (audits?: object[]) => render(<PageSpeedLabImageAudit psiReport={{ imageOptimizationAudits: audits }} />);
beforeEach(async () => { await i18n.changeLanguage('en'); });

it.each([[undefined], [[]]])('shows the missing-audit note for %j', (audits) => {
  show(audits as never);
  expect(screen.getByText(t('pageSpeedUi.noImageAudit'))).toBeTruthy();
  expect(screen.queryAllByRole('article')).toHaveLength(0);
});

it.each([[0, 'pageSpeedUi.problemDetected'], [1, 'pageSpeedUi.passed']])('maps score %s to its verdict badge', (score, key) => {
  show([audit({ score })]);
  expect(screen.getByText(t(key))).toBeTruthy();
});

it('falls back to the mode or unavailable label when there is no verdict', () => {
  show([audit({ id: 'x', score: 0.5, scoreDisplayMode: 'numeric' }), audit({ id: 'y', score: null, scoreDisplayMode: '' })]);
  expect(screen.getByText(t('pageSpeedUi.noVerdict', { mode: 'numeric' }))).toBeTruthy();
  expect(screen.getByText(t('pageSpeedUi.noVerdict', { mode: t('pageSpeedUi.scoreUnavailable') }))).toBeTruthy();
  expect(screen.getAllByText(t('pageSpeedUi.noApiSummary'))).toHaveLength(2);
});

it('shows display value, savings and linkified description', () => {
  show([audit({ displayValue: '12 images', overallSavingsBytes: 2048, description: 'Read [guide](https://web.dev/x) now' })]);
  expect(screen.getByText('12 images')).toBeTruthy();
  expect(screen.getByText(t('pageSpeedUi.estimatedSavings', { value: '2.0 KiB' }))).toBeTruthy();
  const link = screen.getByRole('link', { name: 'guide' });
  expect(link.getAttribute('href')).toBe('https://web.dev/x');
});

it('renders evidence rows with fallbacks for name, bytes and percentages', () => {
  show([audit({ evidenceTruncated: true, evidenceCount: 3, evidence: [
    { url: 'https://e.test/a.png', selector: 'img.a', totalBytes: 4096, wastedBytes: 1024, wastedPercent: 25 },
    { label: 'Hero', totalBytes: null, wastedBytes: null, wastedPercent: null },
    { selector: 'img.c', totalBytes: 10, wastedBytes: 5, wastedPercent: null },
    { totalBytes: null, wastedBytes: null, wastedPercent: null },
  ] })]);
  expect(screen.getByText('https://e.test/a.png')).toBeTruthy();
  expect(screen.getByText(`${t('pageSpeedUi.transfer')}: 4.0 KiB`)).toBeTruthy();
  expect(screen.getByText(`${t('pageSpeedUi.potential')}: 1.0 KiB (25.0%)`)).toBeTruthy();
  expect(screen.getByText('Hero')).toBeTruthy();
  expect(screen.getAllByText(`${t('pageSpeedUi.transfer')}: —`)).toHaveLength(2);
  expect(screen.getByText(`${t('pageSpeedUi.potential')}: 5 B`)).toBeTruthy();
  expect(screen.getByText(t('pageSpeedUi.elementNumber', { count: 4 }))).toBeTruthy();
  expect(screen.getByText(t('pageSpeedUi.firstElements', { count: 3 }))).toBeTruthy();
});

it('omits evidence and savings sections when empty', () => {
  show([audit({ overallSavingsBytes: null, evidence: [] })]);
  expect(screen.queryByText(t('pageSpeedUi.firstElements', { count: 0 }))).toBeNull();
  expect(screen.queryByText(new RegExp(t('pageSpeedUi.transfer')))).toBeNull();
});
