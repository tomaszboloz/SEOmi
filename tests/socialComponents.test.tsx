import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialPlatformTabs } from '@/components/Results/social/SocialPlatformTabs';
import { SocialGoogleSerp } from '@/components/Results/social/SocialGoogleSerp';
import { SocialFacebookCard } from '@/components/Results/social/SocialFacebookCard';
import { SocialTwitterCard } from '@/components/Results/social/SocialTwitterCard';
import { SocialDiscordEmbed } from '@/components/Results/social/SocialDiscordEmbed';
import { SocialSlackBlock } from '@/components/Results/social/SocialSlackBlock';
import { SocialChatCard } from '@/components/Results/social/SocialChatCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('Social Component Extractions', () => {
  it('SocialPlatformTabs renders all platform tabs', () => {
    const setActivePlatform = vi.fn();
    render(<SocialPlatformTabs activePlatform="all" setActivePlatform={setActivePlatform} />);
    
    expect(screen.getByText('legacyUi.social.allPreviews')).toBeDefined();
    expect(screen.getByText('legacyUi.social.googleSerp')).toBeDefined();
    expect(screen.getByText('legacyUi.social.facebook')).toBeDefined();
    expect(screen.getByText('legacyUi.social.twitterTab')).toBeDefined();
    expect(screen.getByText('legacyUi.social.discordTab')).toBeDefined();
    expect(screen.getByText('legacyUi.social.linkedinTab')).toBeDefined();
    expect(screen.getByText('legacyUi.social.slackTab')).toBeDefined();
    expect(screen.getByText('legacyUi.social.chatTab')).toBeDefined();
  });

  it('SocialGoogleSerp renders SERP preview with title and description', () => {
    const mockAudit = { technical: { favicon: '' } } as any;
    render(
      <SocialGoogleSerp
        serpMode="desktop"
        setSerpMode={vi.fn()}
        audit={mockAudit}
        siteName="TestSite"
        displayUrl="https://test.com"
        visibleTitle="My Google Title"
        visibleDescription="My Google Description"
        liveQuery=""
        liveTitle="My Google Title"
        liveDesc="My Google Description"
        estimatedPixelWidth={300}
        sitelinkCandidates={[]}
        richResultPreview={null}
      />
    );
    expect(screen.getByText('My Google Title')).toBeDefined();
    expect(screen.getByText('My Google Description')).toBeDefined();
  });

  it('SocialFacebookCard renders Facebook card', () => {
    render(
      <SocialFacebookCard
        liveImage="image.jpg"
        liveDesc="FB Desc"
        finalUrl="https://fb.com"
      />
    );
    expect(screen.getByText('FB Desc')).toBeDefined();
  });

  it('SocialTwitterCard renders Twitter card', () => {
    render(
      <SocialTwitterCard
        liveImage="img.jpg"
        liveTitle="TW Title"
        liveDesc="TW Desc"
        finalUrl="https://tw.com"
      />
    );
    expect(screen.getByText('TW Title')).toBeDefined();
    expect(screen.getByText('TW Desc')).toBeDefined();
  });

  it('SocialDiscordEmbed renders Discord embed', () => {
    render(
      <SocialDiscordEmbed
        siteName="DiscordSite"
        liveTitle="Discord Title"
        liveDesc="Discord Desc"
        liveImage="img.jpg"
      />
    );
    expect(screen.getByText('Discord Title')).toBeDefined();
    expect(screen.getByText('Discord Desc')).toBeDefined();
  });

  it('SocialSlackBlock renders Slack block', () => {
    render(
      <SocialSlackBlock
        liveTitle="Slack Title"
        liveDesc="Slack Desc"
        liveImage="img.jpg"
      />
    );
    expect(screen.getByText('Slack Title')).toBeDefined();
    expect(screen.getByText('Slack Desc')).toBeDefined();
  });

  it('SocialChatCard renders WhatsApp card', () => {
    render(
      <SocialChatCard
        liveImage="img.jpg"
        liveTitle="WA Title"
        liveDesc="WA Desc"
        finalUrl="https://wa.com"
      />
    );
    expect(screen.getByText('WA Title')).toBeDefined();
    expect(screen.getByText('WA Desc')).toBeDefined();
  });
});
