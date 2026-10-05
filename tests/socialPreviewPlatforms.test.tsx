import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SocialPreview } from '@/components/Results/SocialPreview';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';

const stub = vi.hoisted(() => (name: string) => (p: Record<string, unknown>) => <div data-testid={`card-${name}`} data-image={String(p.liveImage ?? '')} />);
vi.mock('@/components/Results/social/SocialGoogleSerp', () => ({ SocialGoogleSerp: stub('google') }));
vi.mock('@/components/Results/social/SocialFacebookCard', () => ({ SocialFacebookCard: stub('facebook') }));
vi.mock('@/components/Results/social/SocialTwitterCard', () => ({ SocialTwitterCard: stub('twitter') }));
vi.mock('@/components/Results/social/SocialDiscordEmbed', () => ({ SocialDiscordEmbed: stub('discord') }));
vi.mock('@/components/Results/social/SocialLinkedInCard', () => ({ SocialLinkedInCard: stub('linkedin') }));
vi.mock('@/components/Results/social/SocialSlackBlock', () => ({ SocialSlackBlock: stub('slack') }));
vi.mock('@/components/Results/social/SocialChatCard', () => ({ SocialChatCard: stub('chat') }));

const base = {
  url: 'https://example.com/p', final_url: 'https://example.com/p',
  meta_tags: { title: 'Meta title', description: 'Meta description' }, open_graph: {}, twitter_card: {}, images: [],
};
const audit = (over: Record<string, unknown> = {}) => ({ ...base, ...over, open_graph: { ...base.open_graph, ...(over.open_graph as object) }, twitter_card: { ...(over.twitter_card as object) } }) as never;
const field = (key: string) => screen.getByPlaceholderText(i18n.t(key)) as HTMLInputElement;
const cards = () => screen.queryAllByTestId(/^card-/).map((el) => el.getAttribute('data-testid')!.slice(5));
const tab = (key: string) => fireEvent.click(screen.getByRole('button', { name: i18n.t(key) }));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'p1' });
  useAuditStore.setState({ showOnlyProblems: false });
});

describe('SocialPreview platform tabs', () => {
  it('renders every card for "all" and a single card per specific tab', () => {
    render(<SocialPreview audit={audit()} />);
    expect(cards()).toEqual(['google', 'facebook', 'twitter', 'discord', 'linkedin', 'slack', 'chat']);
    const single: Array<[string, string]> = [['googleSerp', 'google'], ['facebook', 'facebook'], ['twitterTab', 'twitter'], ['discordTab', 'discord'], ['linkedinTab', 'linkedin'], ['slackTab', 'slack'], ['chatTab', 'chat']];
    for (const [key, card] of single) {
      tab(`legacyUi.social.${key}`);
      expect(cards()).toEqual([card]);
    }
    tab('legacyUi.social.allPreviews');
    expect(cards()).toHaveLength(7);
  });
});

describe('SocialPreview draft defaults', () => {
  it('prefers Open Graph fields, then meta tags, then the URL and placeholder description', () => {
    const { unmount } = render(<SocialPreview audit={audit({ open_graph: { og_title: 'OG title', og_description: 'OG desc', og_image: 'og.png' } })} />);
    expect([field('legacyUi.social.titlePlaceholder').value, field('legacyUi.social.descriptionPlaceholder').value, field('legacyUi.social.imagePlaceholder').value]).toEqual(['OG title', 'OG desc', 'og.png']);
    unmount();
    localStorage.clear();
    render(<SocialPreview audit={audit({ meta_tags: {} })} />);
    expect(field('legacyUi.social.titlePlaceholder').value).toBe('https://example.com/p');
    expect(field('legacyUi.social.descriptionPlaceholder').value).toBe(i18n.t('legacyUi.social.noDescription'));
  });

  it('falls back to the twitter image, then the first jpg or png, then nothing', () => {
    const run = (over: Record<string, unknown>) => {
      localStorage.clear();
      const view = render(<SocialPreview audit={audit(over)} />);
      const value = field('legacyUi.social.imagePlaceholder').value;
      view.unmount();
      return value;
    };
    expect(run({ twitter_card: { twitter_image: 'tw.png' } })).toBe('tw.png');
    expect(run({ images: [{ src: 'a.gif' }, { src: 'b.png' }, { src: 'c.jpg' }] })).toBe('b.png');
    expect(run({ images: [{ src: 'x.jpg' }] })).toBe('x.jpg');
    expect(run({ images: [{ src: 'a.gif' }] })).toBe('');
  });

  it('resets edits back to the audited metadata', () => {
    render(<SocialPreview audit={audit()} />);
    fireEvent.change(field('legacyUi.social.titlePlaceholder'), { target: { value: 'Edited' } });
    expect(field('legacyUi.social.titlePlaceholder').value).toBe('Edited');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('legacyUi.social.reset')) }));
    expect(field('legacyUi.social.titlePlaceholder').value).toBe('Meta title');
  });
});

describe('SocialPreview length hints, problems-only mode and project switches', () => {
  const counter = (text: RegExp) => screen.getByText(text);

  it('marks title and description counters optimal only inside their ranges', () => {
    render(<SocialPreview audit={audit()} />);
    fireEvent.change(field('legacyUi.social.titlePlaceholder'), { target: { value: 'T'.repeat(45) } });
    fireEvent.change(field('legacyUi.social.descriptionPlaceholder'), { target: { value: 'D'.repeat(130) } });
    expect(counter(/^45 \/ 60/).className).toContain('text-emerald-400');
    expect(counter(/^130 \/ 160/).className).toContain('text-emerald-400');
    fireEvent.change(field('legacyUi.social.titlePlaceholder'), { target: { value: 'T'.repeat(61) } });
    fireEvent.change(field('legacyUi.social.descriptionPlaceholder'), { target: { value: 'D'.repeat(161) } });
    expect(counter(/^61 \/ 60/).className).toContain('text-amber-400');
    expect(counter(/^161 \/ 160/).className).toContain('text-amber-400');
  });

  it('shows only the problem notice when filtering problems', () => {
    useAuditStore.setState({ showOnlyProblems: true });
    render(<SocialPreview audit={audit()} />);
    expect(screen.queryByPlaceholderText(i18n.t('legacyUi.social.titlePlaceholder'))).toBeNull();
    expect(cards()).toEqual([]);
    expect(screen.getByRole('region', { name: i18n.t('componentUi.problems', { subject: i18n.t('social.socialMetadata') }) })).toBeTruthy();
  });

  it('loads each project draft separately without overwriting the previous one', () => {
    const { rerender } = render(<SocialPreview audit={audit()} />);
    fireEvent.change(field('legacyUi.social.titlePlaceholder'), { target: { value: 'Draft for p1' } });
    useProjectStore.setState({ activeProjectId: 'p2' });
    rerender(<SocialPreview audit={audit()} />);
    expect(field('legacyUi.social.titlePlaceholder').value).toBe('Meta title');
    useProjectStore.setState({ activeProjectId: 'p1' });
    rerender(<SocialPreview audit={audit()} />);
    expect(field('legacyUi.social.titlePlaceholder').value).toBe('Draft for p1');
  });
});
