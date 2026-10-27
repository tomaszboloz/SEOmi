import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UserAgentSelector } from '@/components/URLBar/UserAgentSelector';
import { useAuditStore } from '@/stores/auditStore';
import i18n from '@/i18n';

afterEach(cleanup);
describe('audit user agent selector', () => {
  it('displays a custom configured user agent instead of mislabelling it as Chrome', () => {
    useAuditStore.getState().setSelectedUserAgent('Custom crawler/1.0');
    render(<UserAgentSelector />);
    expect(screen.getByText('Custom crawler/1.0')).toBeTruthy();
    expect(screen.queryByText(i18n.t('urlBar.userAgents.chromeMac'))).toBeNull();
  });
  it('applies the chosen preset to the audit store and closes the menu', () => {
    useAuditStore.getState().setSelectedUserAgent('chrome_mac');
    render(<UserAgentSelector />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('urlBar.userAgents.googlebotMobile') }));
    expect(useAuditStore.getState().selectedUserAgent).toBe('googlebot_mobile');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('closes dropdown when clicking the backdrop overlay', () => {
    useAuditStore.getState().setSelectedUserAgent('chrome_mac');
    const { container } = render(<UserAgentSelector />);
    fireEvent.click(screen.getByRole('button'));
    const backdrop = container.querySelector('.fixed.inset-0')!;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
