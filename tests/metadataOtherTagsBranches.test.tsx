import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { MetadataOtherTags } from '@/components/Results/metadata/MetadataOtherTags';
import { createAuditFixture } from './fixtures/audit';

const mocks = vi.hoisted(() => ({ copyText: vi.fn() }));
vi.mock('@/services/clipboard', () => ({ copyText: mocks.copyText }));

const t = (k: string, o?: object): string => String(i18n.t(k, o as never));
const show = (tags: unknown) => render(<MetadataOtherTags audit={createAuditFixture({ meta_tags: { ...createAuditFixture().meta_tags, other_tags: tags as never } })} />);
beforeEach(async () => { await i18n.changeLanguage('en'); mocks.copyText.mockReset().mockResolvedValue(true); });

it.each([[undefined], [[]]])('renders nothing for %j', (tags) => {
  const { container } = show(tags);
  expect(container.firstChild).toBeNull();
});

it('labels tags by name, property or a generic fallback', () => {
  show([{ name: 'robots', content: 'noindex' }, { property: 'fb:app_id', content: '42' }, { content: 'x' }]);
  expect(screen.getByText('name="robots"')).toBeTruthy();
  expect(screen.getByText('property="fb:app_id"')).toBeTruthy();
  expect(screen.getByText('tag')).toBeTruthy();
  expect(screen.getByText(t('legacyUi.metadata.otherTags', { count: 3 }))).toBeTruthy();
});

it('copies the clicked content and flags only that row as copied', async () => {
  show([{ name: 'a', content: 'one' }, { name: 'b', content: 'two' }]);
  const buttons = screen.getAllByTitle(t('legacyUi.metadata.copyContent'));
  fireEvent.click(buttons[1]);
  expect(mocks.copyText).toHaveBeenCalledWith('two');
  await waitFor(() => expect(buttons[1].querySelector('.text-emerald-400')).not.toBeNull());
  expect(buttons[0].querySelector('.text-emerald-400')).toBeNull();
});

it('does not flag a row when the clipboard rejects', async () => {
  mocks.copyText.mockResolvedValue(false);
  show([{ name: 'a', content: 'one' }]);
  const button = screen.getByTitle(t('legacyUi.metadata.copyContent'));
  fireEvent.click(button);
  await waitFor(() => expect(mocks.copyText).toHaveBeenCalledWith('one'));
  expect(button.querySelector('.text-emerald-400')).toBeNull();
});
