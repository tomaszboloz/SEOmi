import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { TrustClaimEvidence } from '@/components/Domain/crawlResults/trust/TrustClaimEvidence';
import { mapClaimsToCitations } from '@/services/citationEvidence/claims';
import { checkReachability, localSupportCheck, reachabilityOf, reachabilityTargets } from '@/services/citationEvidence/support';

const text = 'The trial reduced risk by 20% (doi:10.1000/abc.12). Patients may need a lower dose [3]. The sky is blue today. Treatment does not cause harm in 5% of cases.';

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('local claim support check (#88)', () => {
  it('grades association from the page only and flags hedging and negation', () => {
    const claims = mapClaimsToCitations(text);
    expect(claims.map((claim) => localSupportCheck(claim))).toEqual([
      { level: 'associated', hedged: false, negated: false },
      { level: 'weak', hedged: true, negated: false },
      { level: 'none', hedged: false, negated: true },
    ]);
    expect(claims.every((claim) => claim.supportsClaim === null && claim.sourceChecked === false)).toBe(true);
  });
});

describe('source reachability (#88)', () => {
  it('collects unique resolver targets and maps link statuses without turning failures into broken', async () => {
    const claims = mapClaimsToCitations(`${text} Risk also fell by 20% (doi:10.1000/abc.12).`);
    expect(reachabilityTargets(claims)).toEqual(['https://doi.org/10.1000/abc.12']);
    expect(reachabilityOf(undefined)).toBe('not-checked');
    expect(reachabilityOf({ status: 0, is_broken: true })).toBe('no-response');
    expect(reachabilityOf({ status: 404, is_broken: true })).toBe('broken');
    expect(reachabilityOf({ status: 200, is_broken: false })).toBe('reachable');
    const checker = vi.fn(async (url: string) => { if (url.includes('b')) throw new Error('ipc'); return { status: 200, is_broken: false }; });
    expect(await checkReachability(['https://a.test', 'https://b.test'], checker)).toEqual({ 'https://a.test': 'reachable', 'https://b.test': 'no-response' });
    const aborted = new AbortController(); aborted.abort();
    expect(await checkReachability(['https://a.test'], checker, aborted.signal)).toEqual({});
  });

  it('sends nothing until the user clicks, then labels each source', async () => {
    const checker = vi.fn(async () => ({ status: 200, is_broken: false }));
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
    try {
      render(<TrustClaimEvidence claims={mapClaimsToCitations(text)} checker={checker} />);
      expect(checker).not.toHaveBeenCalled();
      expect(screen.getAllByTestId('trust-claim-support').map((node) => node.getAttribute('data-level'))).toEqual(['associated', 'weak', 'none']);
      fireEvent.click(screen.getByRole('button', { name: 'Check source reachability (1)' }));
      await waitFor(() => expect(screen.getByTestId('trust-source-reach').getAttribute('data-status')).toBe('reachable'));
      expect(checker).toHaveBeenCalledWith('https://doi.org/10.1000/abc.12');
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    }
  });

  it('says the check is desktop-only in the browser preview', async () => {
    const checker = vi.fn();
    render(<TrustClaimEvidence claims={mapClaimsToCitations(text)} checker={checker} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check source reachability (1)' }));
    expect(await screen.findByText('Source checks need the desktop app.')).toBeTruthy();
    expect(checker).not.toHaveBeenCalled();
  });
});
