import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { AiModelPresence } from '@/types';
import { AiBrandModelCard } from '@/components/AiVisibility/brandVisibility/AiBrandModelCard';

const base: AiModelPresence = {
  model_name: 'Fixture model', model_id: null, provider: 'claude', connection_method: 'local_cli',
  captured_at: '2026-10-01T10:00:00Z', is_present: false, visibility_percentage: 0,
  sentiment: 'not_assessed', summary: 'Saved response', cited_sources: [], response_status: 'success',
};
const show = (patch: Partial<AiModelPresence> = {}) => render(<AiBrandModelCard model={{ ...base, ...patch }} t={i18n.t} />);
afterEach(cleanup);

it.each([
  ['positive', 'sentimentPositive'], ['negative', 'sentimentNegative'], ['neutral', 'sentimentNeutral'],
  ['not_assessed', 'sentimentNotAssessed'], ['not_mentioned', 'sentimentNeutral'],
] as const)('renders sentiment %s from a saved response', (sentiment, key) => {
  show({ sentiment });
  expect(screen.getByText(i18n.t(`aiVisibility.brand.${key}`))).toBeTruthy();
  expect(screen.getByText(i18n.t('aiVisibility.brand.noMention'))).toBeTruthy();
  expect(screen.getByText(i18n.t('aiVisibility.brand.noUrl'))).toBeTruthy();
  expect(screen.getByText('Saved response')).toBeTruthy();
});

it('renders a failed response without a successful presence indicator', () => {
  const view = show({ response_status: 'error', error_message: 'Provider unavailable', is_present: true });
  expect(screen.getByRole('alert').textContent).toBe('Provider unavailable');
  expect(screen.getByText(i18n.t('aiVisibility.brand.sentimentError'))).toBeTruthy();
  expect(screen.getByText(i18n.t('aiVisibility.brand.noResponse'))).toBeTruthy();
  expect(screen.queryByText('Saved response')).toBeNull();
  expect(view.container.querySelector('[style]')?.getAttribute('style')).toBe('width: 0%;');
});

it('renders successful mentions, evidence links and unavailable position', () => {
  const view = show({ is_present: true, prompt: 'Which tool?', repetition: 3, search_mode: 'model_knowledge',
    mention_position: null, own_domain_cited: false, competitors_mentioned: ['One', 'Two'],
    cited_sources: ['https://example.com/source'] });
  expect(screen.getByText(i18n.t('aiVisibility.brand.mention'))).toBeTruthy();
  expect(view.container.querySelector('[style]')?.getAttribute('style')).toBe('width: 100%;');
  expect(screen.getByText(`Which tool? · ${i18n.t('aiResearch.run', { count: 3 })}`)).toBeTruthy();
  expect(screen.getByText('One, Two')).toBeTruthy();
  expect(screen.getByText((text) => text.includes(i18n.t('aiResearch.position', { value: '—' })) && text.includes(i18n.t('aiResearch.ownDomainNo')))).toBeTruthy();
  const anchor = screen.getByRole('link', { name: 'https://example.com/source' });
  expect(anchor.getAttribute('href')).toBe('https://example.com/source');
  expect(anchor.getAttribute('target')).toBe('_blank');
  expect(anchor.getAttribute('rel')).toBe('noreferrer');
});

it('shows a known position and own-domain citation without competitors', () => {
  show({ search_mode: 'web_enabled', mention_position: 2, own_domain_cited: true, competitors_mentioned: [] });
  expect(screen.getByText((text) => text.includes(i18n.t('aiResearch.position', { value: 2 })) && text.includes(i18n.t('aiResearch.ownDomainYes')))).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});
