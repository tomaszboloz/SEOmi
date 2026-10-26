import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import LogIntelligencePanel from '@/components/Domain/crawlResults/logIntelligence/LogIntelligencePanel';
import { canonicalIp, verifyBot } from '@/services/logIntelligence';
import { desktopResolver } from '@/services/logIntelligence/desktopResolver';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { logRun } from './fixtures/logIntel';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: vi.fn(() => false), getSecureValue: vi.fn(async () => '') }));

const GOOGLE = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

beforeEach(async () => { vi.mocked(invokeTauriCommand).mockReset(); vi.mocked(isTauriEnvironment).mockReturnValue(false); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('desktop DNS bot verification', () => {
  it('has no resolver in the browser build and calls the two native commands on desktop', async () => {
    expect(desktopResolver()).toBeUndefined();
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(invokeTauriCommand).mockResolvedValueOnce(['crawl-66-249-66-1.googlebot.com']).mockResolvedValueOnce(['66.249.66.1']);
    const resolver = desktopResolver()!;
    expect(await resolver.reverse('66.249.66.1')).toEqual(['crawl-66-249-66-1.googlebot.com']);
    expect(await resolver.forward('crawl-66-249-66-1.googlebot.com')).toEqual(['66.249.66.1']);
    expect(invokeTauriCommand).toHaveBeenNthCalledWith(1, 'dns_reverse', { ip: '66.249.66.1' });
    expect(invokeTauriCommand).toHaveBeenNthCalledWith(2, 'dns_forward', { host: 'crawl-66-249-66-1.googlebot.com' });
  });

  it('verifies a Googlebot through the desktop resolver, marks a fake as spoofed and keeps failures as claimed', async () => {
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    const resolver = desktopResolver()!;
    vi.mocked(invokeTauriCommand).mockResolvedValueOnce(['crawl.googlebot.com']).mockResolvedValueOnce(['66.249.66.1']);
    expect((await verifyBot('66.249.66.1', GOOGLE, { resolver })).status).toBe('verified');
    vi.mocked(invokeTauriCommand).mockResolvedValueOnce(['evil.example.net']);
    expect((await verifyBot('203.0.113.9', GOOGLE, { resolver })).status).toBe('spoofed');
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('DNS lookup timed out'));
    expect((await verifyBot('66.249.66.2', GOOGLE, { resolver })).status).toBe('claimed');
  });

  it('compares IPv6 addresses by canonical form so spelling differences are not spoofing', async () => {
    expect(canonicalIp('2001:4860:4860:0:0:0:0:8888')).toBe('2001:4860:4860::8888');
    expect(canonicalIp(' 8.8.8.8 ')).toBe('8.8.8.8');
    expect(canonicalIp('zz::bad::')).toBe('zz::bad::');
    const resolver = { reverse: async () => ['crawl.googlebot.com'], forward: async () => ['2001:4860:4860::8888'] };
    expect((await verifyBot('2001:4860:4860:0:0:0:0:8888', GOOGLE, { resolver })).status).toBe('verified');
  });

  it('describes DNS verification on desktop and the missing resolver in the browser', () => {
    render(<LogIntelligencePanel projectId="dns-p" run={logRun([['/a']]) as never} />);
    expect(screen.getByText(/does not call DNS/)).toBeTruthy();
    cleanup();
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    render(<LogIntelligencePanel projectId="dns-p" run={logRun([['/a']]) as never} />);
    expect(screen.getByText(/reverse and forward DNS \(3 s timeout\)/)).toBeTruthy();
  });
});
