import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { TrustClaimEvidence } from '@/components/Domain/crawlResults/trust/TrustClaimEvidence';
import { mapClaimsToCitations } from '@/services/citationEvidence/claims';

const claims = mapClaimsToCitations('Statin therapy reduced cardiovascular mortality by 22% in adults, PMID: 42.');
const SOURCE = 'Statin therapy reduced cardiovascular mortality by 22% in adults over five years (PMID: 42).';

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

describe('TrustClaimEntailment (#88)', () => {
  it('runs the local heuristic and labels it as association evidence', async () => {
    render(<TrustClaimEvidence claims={claims} projectId="p1" />);
    const run = screen.getByRole('button', { name: 'Compare claims with source text' });
    expect((run as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Source text to compare (paste)'), { target: { value: SOURCE } });
    fireEvent.click(run);
    const result = await screen.findByTestId('trust-entail-result');
    expect(result.dataset.label).toBe('consistent');
    expect(result.dataset.method).toBe('heuristic');
    expect(screen.getByText(/does not mark the claim as verified/)).toBeTruthy();
  });

  it('persists the model setting; without a connected model the heuristic is used', async () => {
    const { unmount } = render(<TrustClaimEvidence claims={claims} />);
    const box = screen.getByRole('checkbox', { name: /local model/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    fireEvent.change(screen.getByLabelText('Source text to compare (paste)'), { target: { value: SOURCE } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare claims with source text' }));
    await waitFor(() => expect(screen.getByTestId('trust-entail-result').dataset.method).toBe('heuristic'));
    unmount();
    render(<TrustClaimEvidence claims={claims} />);
    expect((screen.getByRole('checkbox', { name: /local model/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('exposes labelled controls and an accessible result list (axe-style)', async () => {
    render(<TrustClaimEvidence claims={claims} />);
    for (const el of screen.getAllByRole('textbox')) expect(el.getAttribute('id')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: SOURCE } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare claims with source text' }));
    expect((await screen.findByRole('list', { name: 'Comparison results' })).querySelectorAll('li')).toHaveLength(1);
  });
});
