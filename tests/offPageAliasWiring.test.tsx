import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { OffPageAliasSenses } from '@/components/Domain/backlinkChecker/OffPageAliasSenses';
import { analyzeSources } from '@/services/offPage/analyzeSources';
import { formatAliasSenses, loadAliasSenses, parseAliasSenses, saveAliasSenses } from '@/services/offPage/aliasSenseStore';
import { createOffPageHistoryRecord } from '@/services/offPage/historyRecord';
import { invokeTauriCommand } from '@/services/tauri/transport';
import { completedAnalysis } from './fixtures/offPageHistory';
import { sourceAudit, sourceLink, sourceProfile } from './fixtures/offPageSources';

vi.mock('@/services/tauri/transport', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@/services/offPage/sourcePacer', () => ({ waitForSourceSlot: async () => {} }));
const senses = [{ alias: 'Acme', excludeContext: ['juice'], requireContext: ['seo'] }];
beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

it('parses and formats rules, ignoring blank aliases and empty parts', () => {
  const parsed = parseAliasSenses('Orange | -juice, fruit | +telecom\n\n | -x\nApple\nPear | +a | -b');
  expect(parsed).toEqual([{ alias: 'Orange', excludeContext: ['juice', 'fruit'], requireContext: ['telecom'] },
    { alias: 'Apple' }, { alias: 'Pear', excludeContext: ['b'], requireContext: ['a'] }]);
  expect(formatAliasSenses(parsed)).toBe('Orange | -juice, fruit | +telecom\nApple\nPear | -b | +a');
});

it('persists per project, rejects invalid rules, removes empty and corrupt entries', () => {
  expect(loadAliasSenses(null)).toEqual([]);
  expect(saveAliasSenses(null, senses)).toBe(false);
  expect(saveAliasSenses('p', [{ alias: '' }])).toBe(false);
  expect(saveAliasSenses('p', senses)).toBe(true);
  expect(loadAliasSenses('p')).toEqual(senses);
  expect(saveAliasSenses('p', [])).toBe(true);
  expect(loadAliasSenses('p')).toEqual([]);
  localStorage.setItem('seomi.offpage.aliasSenses.p', '{broken');
  expect(loadAliasSenses('p')).toEqual([]);
  localStorage.setItem('seomi.offpage.aliasSenses.p', '[{"alias":1}]');
  expect(loadAliasSenses('p')).toEqual([]);
  expect(localStorage.getItem('seomi.offpage.aliasSenses.p')).toBeNull();
});

it('analyzeSources carries rules on the analysis and history excludes the other sense', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(sourceAudit('Acme juice and SEO together'));
  const profile = sourceProfile([sourceLink('https://x.test')]);
  const plain = await analyzeSources(profile, 'Acme', 'SEO', 'SEO', { provider: 'local' }, new AbortController().signal, vi.fn());
  expect(plain.senses).toBeUndefined();
  const ruled = await analyzeSources(profile, 'Acme', 'SEO', 'SEO', { provider: 'local' }, new AbortController().signal, vi.fn(), profile.domain, senses);
  expect(ruled.senses).toEqual(senses);
  expect(createOffPageHistoryRecord({ ...ruled, topic: null }, { provider: 'local' }).coCitations).toEqual([]);
  expect(createOffPageHistoryRecord({ ...ruled, senses: undefined, topic: null }, { provider: 'local' }).coCitations).toHaveLength(1);
  expect(createOffPageHistoryRecord({ ...completedAnalysis(), senses: [] }, { provider: 'local' }).coCitations).toHaveLength(1);
});

it('editor saves on blur and reports a failed save; disabled without project', () => {
  const { rerender } = render(<OffPageAliasSenses projectId="p" disabled={false} />);
  const box = screen.getByLabelText('Alias rules (homonyms)');
  fireEvent.change(box, { target: { value: 'Acme | -juice' } });
  fireEvent.blur(box);
  expect(loadAliasSenses('p')).toEqual([{ alias: 'Acme', excludeContext: ['juice'] }]);
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.change(box, { target: { value: `${'x'.repeat(61)} | -a` } });
  fireEvent.blur(box);
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.change(box, { target: { value: 'ok' } });
  expect(screen.queryByRole('alert')).toBeNull();
  rerender(<OffPageAliasSenses projectId={null} disabled={false} />);
  expect((box as HTMLTextAreaElement).disabled).toBe(true);
});
