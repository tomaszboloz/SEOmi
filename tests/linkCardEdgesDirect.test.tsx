import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinkCard } from '@/components/Results/links/LinkCard';
import i18n from '@/i18n';

vi.mock('@/components/Results/ShowOnPageButton', () => ({ ShowOnPageButton: () => null }));

afterEach(() => vi.restoreAllMocks());

describe('link card display edge contracts', () => {
  it('renders safe external links with no anchor text and confirms copied state', () => {
    const link = { href: 'https://example.test/docs', text: '', is_internal: false };
    const handleCopy = vi.fn();
    const handleVerify = vi.fn();
    render(<LinkCard link={link} pageUrl="https://example.test" isPageHttps={false}
      copiedUrl={link.href} handleCopy={handleCopy} handleVerifySingleLink={handleVerify} />);

    expect(screen.getByText(i18n.t('legacyUi.links.externalLabel'))).toBeTruthy();
    expect(screen.getByText(i18n.t('legacyUi.links.noAnchor'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('legacyUi.links.tabnabbing'))).toBeNull();
    expect(screen.queryByText(i18n.t('legacyUi.links.mixedContent'))).toBeNull();
    expect(screen.getByTitle(i18n.t('legacyUi.links.copyUrl')).querySelector('svg')).toBeTruthy();
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.pingTitle')));
    expect(handleVerify).toHaveBeenCalledWith(link.href);
    fireEvent.click(screen.getByTitle(i18n.t('legacyUi.links.copyUrl')));
    expect(handleCopy).toHaveBeenCalledWith(link.href);
  });

  it('shows offline evidence when a verified link has no status or error', () => {
    const link = { href: 'https://example.test/docs', text: 'Docs', is_internal: true };
    render(<LinkCard link={link} pageUrl="https://example.test" isPageHttps
      copiedUrl={null} handleCopy={vi.fn()} handleVerifySingleLink={vi.fn()}
      verified={{ status: 0, isBroken: false }} />);

    expect(screen.getByText(i18n.t('legacyUi.links.offline'))).toBeTruthy();
    expect(screen.queryByTitle(i18n.t('legacyUi.links.pingTitle'))).toBeNull();
  });
});
