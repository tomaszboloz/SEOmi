import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SocialTagList, socialResourceStatus } from '@/components/Domain/crawlResults/crawlSocialParts';
import type { CrawledPageSummary } from '@/types';

type Check = Parameters<typeof socialResourceStatus>[0];
const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key);

it('describes unchecked, failed and measured social resources', () => {
  expect(socialResourceStatus({ checked_in_run: false } as Check, t)).toBe('crawl.social.notChecked');
  expect(socialResourceStatus({ checked_in_run: true, request_error_kind: 'timeout' } as Check, t)).toBe('crawl.social.requestError:{"kind":"timeout"}');
  expect(socialResourceStatus({ checked_in_run: true, http_status: null } as unknown as Check, t)).toBe('crawl.social.noHttpStatus');
  const measured = socialResourceStatus({ checked_in_run: true, http_status: 200, content_length: 0, intrinsic_width: 1200, intrinsic_height: 630, content_type: 'image/png' } as Check, t);
  expect(measured.split(' · ')).toEqual(['crawl.ui.httpStatus:{"status":200}', expect.stringMatching(/^0 B$/), '1200 × 630', 'crawl.social.intrinsic', 'image/png']);
});

it('lists only tags with the requested prefix and flags missing or empty content', () => {
  const page = { social_meta_tags: [
    { key: 'og:title', content: 'Title', resource_check: { checked_in_run: false } },
    { key: 'og:image', content: null }, { key: 'og:description', content: '' }, { key: 'twitter:card', content: 'summary' },
  ] } as unknown as CrawledPageSummary;
  const view = render(<SocialTagList page={page} prefix="og:" t={t} />);
  expect(screen.getByText('Title')).toBeTruthy();
  expect(screen.getByText('crawl.social.notChecked')).toBeTruthy();
  expect(screen.getByText('crawl.social.missingContent')).toBeTruthy();
  expect(screen.getByText('crawl.social.emptyContent')).toBeTruthy();
  expect(screen.queryByText('summary')).toBeNull();
  view.rerender(<SocialTagList page={{ social_meta_tags: [] } as unknown as CrawledPageSummary} prefix="twitter:" t={t} />);
  expect(screen.getByText('crawl.social.noDeclaration')).toBeTruthy();
});
