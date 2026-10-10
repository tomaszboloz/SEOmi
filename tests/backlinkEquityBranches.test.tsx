import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import type { BacklinkProfileData } from '@/types';
import { BacklinkEquityAndAnchors } from '@/components/Domain/backlinkChecker/BacklinkEquityAndAnchors';
import { backlinkProfileFixture } from './fixtures/backlinkSlice';

const show = (patch: Partial<BacklinkProfileData> = {}, isLoading = false, load = vi.fn()) => render(<BacklinkEquityAndAnchors profile={{ ...backlinkProfileFixture, ...patch }} isLoading={isLoading} loadMoreBacklinkAnchors={load} t={i18n.t} />);
afterEach(cleanup);

it('renders unknown ratios and counts without invented percentages', () => {
  show({ total_anchor_rows: null });
  expect(screen.getByText(`${i18n.t('backlinkUi.dofollow')}: —`)).toBeTruthy();
  expect(screen.getByText(`${i18n.t('backlinkUi.nofollow')}: —`)).toBeTruthy();
  expect(screen.getByText(i18n.t('backlinkUi.noAnchors'))).toBeTruthy();
  expect(screen.getByText(i18n.t('backlinkUi.anchorSummary', { count: 0, total: i18n.t('backlinkUi.unknownCount') }))).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

it('shows measured ratios and anchor percentages, preserving zero', () => {
  const view = show({ dofollow_ratio: 80, total_anchor_rows: 2, anchors: [
    { anchor: 'Known', count: 4, percentage: 40 }, { anchor: 'Unknown', count: 0, percentage: null },
  ] });
  expect(screen.getByText(`${i18n.t('backlinkUi.dofollow')}: 80%`)).toBeTruthy();
  expect(screen.getByText(`${i18n.t('backlinkUi.nofollow')}: 20.0%`)).toBeTruthy();
  expect(screen.getByText(i18n.t('backlinkUi.anchorCount', { count: 4, percentage: '40%' }))).toBeTruthy();
  expect(screen.getByText(i18n.t('backlinkUi.anchorCount', { count: 0, percentage: '—' }))).toBeTruthy();
  expect([...view.container.querySelectorAll('[style]')].map((el) => el.getAttribute('style'))).toEqual(['width: 80%;', 'width: 20%;', 'width: 40%;', 'width: 0%;']);
  expect(screen.queryByRole('button')).toBeNull();
});

it('requests more anchors only through the enabled button', () => {
  const load = vi.fn();
  const view = show({}, false, load);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('backlinkUi.loadAnchors') }));
  expect(load).toHaveBeenCalledTimes(1);
  view.unmount();
  show({}, true, load);
  const button = screen.getByRole('button', { name: i18n.t('backlinkUi.loading') }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(load).toHaveBeenCalledTimes(1);
});
