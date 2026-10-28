import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const copyText = vi.fn(async (_value: string) => true);
vi.mock('@/services/clipboard', () => ({ copyText: (value: string) => copyText(value) }));

import '@/i18n';
import { ContextualLinkInjectorPanel } from '@/components/Charts/ContextualLinkInjectorPanel';
import type { LinkInjection } from '@/services/linkInjector';

afterEach(() => { cleanup(); copyText.mockClear(); });

const row = (patch: Partial<LinkInjection> = {}): LinkInjection => ({
  id: 'a=>b', sourceUrl: 'https://s.test/a', sourceTitle: 'Donor', targetUrl: 'https://s.test/b', targetTitle: 'Target',
  sharedTerms: ['solar'], weightedJaccard: 0.5, section: { heading: 'Guide', level: 2, index: 0, termHits: 3, matchedTerms: ['solar'] },
  expectedSprGain: 4.25, language: 'en', languageFallback: false, anchor: 'Target',
  html: '<p>See also: <a href="https://s.test/b">Target</a>.</p>', markdown: 'See also: [Target](https://s.test/b).', ...patch,
});

it('shows a readable empty state', () => {
  render(<ContextualLinkInjectorPanel injections={[]} />);
  expect(screen.getByText('No candidate has a donor H2/H3 section that mentions the shared terms.')).toBeTruthy();
});

it('shows location, solver gain and copies the snippet in the chosen format', async () => {
  render(<ContextualLinkInjectorPanel injections={[row(), row({ id: 'c=>d', expectedSprGain: null, languageFallback: true })]} />);
  expect(screen.getAllByText('Place in H2 "Guide" (3 shared-term mentions)')).toHaveLength(2);
  expect(screen.getByText('Expected SPRS change of the target: +4.3 (0–100 scale)')).toBeTruthy();
  expect(screen.getByText('Expected SPRS change: unknown (page outside the solver graph)')).toBeTruthy();
  expect(screen.getByText('Page language unknown: the sentence is in English.')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
  await waitFor(() => expect(copyText).toHaveBeenCalledWith('<p>See also: <a href="https://s.test/b">Target</a>.</p>'));
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: 'Markdown' }));
  expect(screen.getAllByText('See also: [Target](https://s.test/b).')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
  await waitFor(() => expect(copyText).toHaveBeenLastCalledWith('See also: [Target](https://s.test/b).'));
});

it('formats a negative or zero change without a plus sign', () => {
  render(<ContextualLinkInjectorPanel injections={[row({ expectedSprGain: -1 }), row({ id: 'z', expectedSprGain: 0 })]} />);
  expect(screen.getByText('Expected SPRS change of the target: -1.0 (0–100 scale)')).toBeTruthy();
  expect(screen.getByText('Expected SPRS change of the target: 0.0 (0–100 scale)')).toBeTruthy();
});
