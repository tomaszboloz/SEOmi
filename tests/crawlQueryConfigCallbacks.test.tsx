import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlQueryConfig } from '@/components/Domain/siteAudit/configForm/CrawlQueryConfig';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';
import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import i18n from '@/i18n';

type Session = ReturnType<typeof useSiteAuditSession>;
const makeSession = (keepQueryStrings: boolean) => ({
  crawlConfig: { ...DEFAULT_CRAWL_CONFIG, keepQueryStrings },
  setCrawlConfig: vi.fn(), setQueryParameterNames: vi.fn(), t: i18n.t,
} as unknown as Session);

describe('direct query configuration control contracts', () => {
  it('dispatches boolean URL normalization controls and hides query editors when disabled', () => {
    const session = makeSession(false);
    const view = render(<CrawlQueryConfig session={session} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.queryByRole('textbox')).toBeNull();
    for (const [key, field] of [['keepQueryStrings', 'keepQueryStrings'], ['trimTrailingSlash', 'trimTrailingSlash'], ['lowercasePath', 'lowercasePath']]) {
      fireEvent.click(screen.getByLabelText(i18n.t(`siteAudit.${key}`)));
      expect(session.setCrawlConfig).toHaveBeenLastCalledWith({ [field]: true });
    }
    view.rerender(<CrawlQueryConfig session={{ ...session, crawlConfig: { ...session.crawlConfig, keepQueryStrings: true, trimTrailingSlash: true, lowercasePath: true } }} />);
    for (const [key, field] of [['keepQueryStrings', 'keepQueryStrings'], ['trimTrailingSlash', 'trimTrailingSlash'], ['lowercasePath', 'lowercasePath']]) {
      fireEvent.click(screen.getByLabelText(i18n.t(`siteAudit.${key}`)));
      expect(session.setCrawlConfig).toHaveBeenLastCalledWith({ [field]: false });
    }
  });
  it('preserves query editor values and delegates literal user input to normalization', () => {
    const session = makeSession(true);
    session.crawlConfig.allowedQueryParameters = ['page', 'category'];
    session.crawlConfig.deniedQueryParameters = ['utm_source'];
    const view = render(<CrawlQueryConfig session={session} />);
    const fields = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
    expect(fields.map((field) => field.value)).toEqual(['page\ncategory', 'utm_source']);
    fireEvent.change(fields[0], { target: { value: ' page, query\nsort ' } });
    expect(session.setQueryParameterNames).toHaveBeenLastCalledWith('allowedQueryParameters', ' page, query\nsort ');
    fireEvent.change(fields[1], { target: { value: 'utm_campaign, ref' } });
    expect(session.setQueryParameterNames).toHaveBeenLastCalledWith('deniedQueryParameters', 'utm_campaign, ref');
    fireEvent.click(screen.getByLabelText(i18n.t('siteAudit.stripTracking')));
    expect(session.setCrawlConfig).toHaveBeenLastCalledWith({ stripTrackingParameters: !session.crawlConfig.stripTrackingParameters });
    view.rerender(<CrawlQueryConfig session={{ ...session, crawlConfig: { ...session.crawlConfig, allowedQueryParameters: undefined, deniedQueryParameters: undefined } }} />);
    expect(fields.map((field) => field.value)).toEqual(['', '']);
  });
});
