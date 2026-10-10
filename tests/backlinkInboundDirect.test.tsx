import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BacklinkInboundTable } from '@/components/Domain/backlinkChecker/BacklinkInboundTable';
import type { BacklinkProfileData } from '@/types';
import i18n from '@/i18n';

const profile = (patch: Partial<BacklinkProfileData> = {}): BacklinkProfileData => ({
  domain: 'example.test', total_backlinks: 0, referring_domains: 0, referring_subnets: 0,
  domain_rank: 0, dofollow_ratio: 0, anchors: [], total_anchor_rows: 0, backlinks: [], total_backlink_rows: null, ...patch,
});
const label = (key: string) => i18n.t(`backlinkUi.${key}`);

describe('inbound backlink pagination contracts', () => {
  it('shows an unknown total and an empty observed page without a load action', () => {
    render(<BacklinkInboundTable profile={profile()} isLoading={false} loadMoreBacklinks={vi.fn()} t={i18n.t} />);
    expect(screen.getByText(`0 / ${label('unknownCount')}`)).toBeTruthy();
    expect(screen.getByText(label('noBacklinks'))).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it.each([false, true])('prevents duplicate pagination while loading=%s', (isLoading) => {
    const load = vi.fn();
    render(<BacklinkInboundTable profile={profile({ total_backlink_rows: 3 })} isLoading={isLoading} loadMoreBacklinks={load} t={i18n.t} />);
    expect(screen.getByText('0 / 3')).toBeTruthy();
    expect(screen.getByText(label('moreBacklinkNotice'))).toBeTruthy();
    const button = screen.getByRole('button', { name: label(isLoading ? 'loading' : 'loadBacklinks') });
    expect((button as HTMLButtonElement).disabled).toBe(isLoading);
    fireEvent.click(button);
    expect(load).toHaveBeenCalledTimes(isLoading ? 0 : 1);
  });
  it('shows nofollow evidence and removes pagination when all returned rows are loaded', () => {
    const data = profile({ total_backlink_rows: 1, backlinks: [{ source_url: 'https://source.test/', source_title: 'Source',
      target_url: 'https://example.test/', anchor_text: 'Anchor', is_dofollow: false, domain_rank: 0, first_seen: '2026-01-01' }] });
    render(<BacklinkInboundTable profile={data} isLoading={false} loadMoreBacklinks={vi.fn()} t={i18n.t} />);
    expect(screen.getByText('1 / 1')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText('https://source.test/')).toBeTruthy();
    expect(screen.getByText('"Anchor"')).toBeTruthy();
    expect(screen.getByText(label('nofollow'))).toBeTruthy();
    expect(screen.getByText('2026-01-01')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
