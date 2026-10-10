import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityHeaderCard } from '@/components/Results/securityHeaders/SecurityHeaderCard';
import { SocialLinkedInCard } from '@/components/Results/social/SocialLinkedInCard';
import { TargetPhraseTopTenRow } from '@/components/Results/targetPhraseAudit/TargetPhraseTopTenRow';
import { SeoToolsPanelHeader } from '@/components/SeoTools/workspace/SeoToolsPanelHeader';
import type { HeaderSpec } from '@/components/Results/securityHeaders/securityHeadersTypes';
import type { TopTenPageObservation } from '@/services/targetPhraseAudit';

describe('unreferenced components batch 6 direct assertions', () => {
  it('SecurityHeaderCard renders header title and status', () => {
    const spec = {
      title: 'CSP',
      importance: 'Critical',
      description: 'Restricts resource loading',
      value: "default-src 'self'",
    } as any as HeaderSpec;
    const t = ((k: string) => k) as any;

    render(<SecurityHeaderCard spec={spec} t={t} />);
    expect(screen.getByText('CSP')).toBeTruthy();
    expect(screen.getByText("default-src 'self'")).toBeTruthy();
  });

  it('SocialLinkedInCard renders title and domain', () => {
    render(
      <SocialLinkedInCard
        liveImage="https://example.com/og.png"
        liveTitle="LinkedIn Post Title"
        finalUrl="https://example.com/post"
      />,
    );

    expect(screen.getByText('LinkedIn Post Title')).toBeTruthy();
    expect(screen.getByText('example.com')).toBeTruthy();
  });

  it('TargetPhraseTopTenRow renders rank and target link', () => {
    const row = {
      rank: 1,
      url: 'https://example.com/serp-1',
      availability: 'available',
      status: 200,
    } as any as TopTenPageObservation;

    render(<TargetPhraseTopTenRow row={row} />);
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByRole('link', { name: /serp-1/ }).getAttribute('href')).toBe(row.url);
  });

  it('SeoToolsPanelHeader renders title and description', () => {
    render(
      <SeoToolsPanelHeader
        title="Keyword Density Tool"
        description="Analyze keyword frequency across HTML body"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Keyword Density Tool' })).toBeTruthy();
    expect(screen.getByText('Analyze keyword frequency across HTML body')).toBeTruthy();
  });
});
