import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { GapBriefPanel } from '@/components/Domain/crawlResults/authority/GapBriefPanel';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { clearAuthorityBriefCache } from '@/services/topicalAuthorityReference';
import { useAuthStore } from '@/stores/authStore';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const report = buildAuthorityReport(pages, `https://${OWN_HOST}/`, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW });
const row = { ...report.coverage[0], coverage: 0 as const, entitiesMissing: [], questionsMissing: [] };
const generate = () => fireEvent.click(screen.getByRole('button', { name: 'Generate AI brief' }));

beforeEach(async () => {
  clearAuthorityBriefCache();
  await i18n.changeLanguage('en');
});
afterEach(() => vi.restoreAllMocks());

describe('GapBriefPanel asynchronous generation', () => {
  it('disables repeat submission until the provider resolves, then reuses the successful brief', async () => {
    let resolve!: (text: string) => void;
    const generateText = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    render(<GapBriefPanel report={report} row={row} deps={() => ({ isConfigured: () => true, generateText })} />);
    generate();
    const pending = screen.getByRole('button', { name: i18n.t('authority.brief.generating') }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);
    fireEvent.click(pending);
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('authority-ai-brief')).toBeNull();
    await act(async () => { resolve('A useful outline'); });
    expect(screen.getByTestId('authority-ai-brief').textContent).toBe('A useful outline');
    expect((screen.getByRole('button', { name: 'Generate AI brief' }) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { generate(); });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('authority-ai-brief').textContent).toBe('A useful outline');
  });

  it('allows retry after a rejected request and replaces the error with the recovered result', async () => {
    let reject!: (error: Error) => void;
    const generateText = vi.fn(() => new Promise<string>((_, fail) => { reject = fail; }))
      .mockResolvedValueOnce('');
    render(<GapBriefPanel report={report} row={row} deps={() => ({ isConfigured: () => true, generateText })} />);
    await act(async () => { generate(); });
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('authority.brief.empty'));
    generate();
    await act(async () => { reject(new Error('provider unavailable')); });
    expect(screen.getByRole('alert').textContent).toContain('provider unavailable');
    generateText.mockResolvedValueOnce('Recovered outline');
    await act(async () => { generate(); });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('authority-ai-brief').textContent).toBe('Recovered outline');
    expect(generateText).toHaveBeenCalledTimes(3);
  });

  it('uses the connected auth provider by default, including a report without a taxonomy', async () => {
    const auth = useAuthStore.getState();
    const configured = vi.spyOn(auth, 'isProviderConnected').mockReturnValue(false);
    const generateText = vi.spyOn(auth, 'generateText').mockResolvedValue('Connected outline');
    render(<GapBriefPanel report={{ ...report, taxonomy: null }} row={row} />);
    await act(async () => { generate(); });
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('authority.brief.noKey'));
    expect(generateText).not.toHaveBeenCalled();
    configured.mockReturnValue(true);
    await act(async () => { generate(); });
    expect(generateText).toHaveBeenCalledWith(expect.any(String));
    expect(screen.getByTestId('authority-ai-brief').textContent).toBe('Connected outline');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
