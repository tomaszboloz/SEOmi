import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n';
import { MetadataSpotlight } from '@/components/Results/metadata/MetadataSpotlight';
import { useUIStore } from '@/stores/uiStore';
import type { PageAuditData } from '@/types';

const { copyMock } = vi.hoisted(() => ({ copyMock: vi.fn() }));
vi.mock('@/services/clipboard', () => ({ copyText: copyMock }));

const audit = (title: string | null, tl: number, description: string | null, dl: number) =>
  ({ meta_tags: { title, title_length: tl, description, description_length: dl } }) as unknown as PageAuditData;
const bars = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('div.h-full'));

describe('MetadataSpotlight', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); copyMock.mockReset(); });

  it('colors the length bars by optimal, long and short ranges and clamps width', () => {
    const optimal = render(<MetadataSpotlight audit={audit('T', 50, 'D', 140)} />).container;
    expect(bars(optimal).map((b) => b.className.match(/bg-\w+-500/)?.[0])).toEqual(['bg-emerald-500', 'bg-emerald-500']);
    expect(bars(optimal)[0].style.width).toBe(`${(50 / 60) * 100}%`);
    const long = render(<MetadataSpotlight audit={audit('T', 90, 'D', 200)} />).container;
    expect(bars(long).map((b) => b.className.match(/bg-\w+-500/)?.[0])).toEqual(['bg-amber-500', 'bg-amber-500']);
    expect(bars(long).map((b) => b.style.width)).toEqual(['100%', '100%']);
    const short = render(<MetadataSpotlight audit={audit('T', 10, 'D', 20)} />).container;
    expect(bars(short).map((b) => b.className.match(/bg-\w+-500/)?.[0])).toEqual(['bg-rose-500', 'bg-rose-500']);
  });

  it('shows missing placeholders when title and description are absent', () => {
    render(<MetadataSpotlight audit={audit(null, 0, null, 0)} />);
    expect(screen.getByText(i18n.t('legacyUi.metadata.missingTitle'))).toBeTruthy();
    expect(screen.getByText(i18n.t('legacyUi.metadata.missingDescription'))).toBeTruthy();
  });

  it('opens the AI modal from the optimize button', () => {
    const openModal = vi.fn();
    useUIStore.setState({ openModal } as never);
    render(<MetadataSpotlight audit={audit('T', 50, 'D', 140)} />);
    fireEvent.click(screen.getByText(i18n.t('legacyUi.metadata.aiOptimize')));
    expect(openModal).toHaveBeenCalledWith('ai');
  });

  it('copies title and description, and ignores a failed copy', async () => {
    copyMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    const { container } = render(<MetadataSpotlight audit={audit('My title', 50, 'My desc', 140)} />);
    const titleBtn = screen.getByTitle(i18n.t('legacyUi.metadata.copyTitle'));
    const descBtn = screen.getByTitle(i18n.t('legacyUi.metadata.copyDescription'));
    fireEvent.click(titleBtn);
    await waitFor(() => expect(copyMock).toHaveBeenCalledWith('My title'));
    expect(container.querySelectorAll('svg.text-emerald-400.w-3\\.5')).toHaveLength(0);
    fireEvent.click(titleBtn);
    await waitFor(() => expect(titleBtn.querySelector('svg.text-emerald-400')).toBeTruthy());
    expect(descBtn.querySelector('svg.text-emerald-400')).toBeNull();
    fireEvent.click(descBtn);
    await waitFor(() => expect(copyMock).toHaveBeenLastCalledWith('My desc'));
    await waitFor(() => expect(descBtn.querySelector('svg.text-emerald-400')).toBeTruthy());
    expect(titleBtn.querySelector('svg.text-emerald-400')).toBeNull();
  });

  it('copies empty strings for missing values', async () => {
    copyMock.mockResolvedValue(true);
    render(<MetadataSpotlight audit={audit(null, 0, null, 0)} />);
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.metadata.copyTitle')));
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.metadata.copyDescription')));
    await waitFor(() => expect(copyMock).toHaveBeenCalledTimes(2));
    expect(copyMock.mock.calls).toEqual([[''], ['']]);
  });
});
