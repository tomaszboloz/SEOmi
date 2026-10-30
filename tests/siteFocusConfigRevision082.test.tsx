import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useFocusConfigRevision } from '@/hooks/useFocusConfigRevision';
import { focusConfigHash } from '@/services/siteFocus';
import {
  FOCUS_CONFIG_EVENT, focusConfigRevision, onFocusConfigChanged, writeAnchorUrls, writeBrandPolicy, writeBusinessGoal, writeManualTopic,
} from '@/services/siteFocusMonitoring';
import { BrandPolicyPanel } from '@/components/Domain/crawlResults/focus/BrandPolicyPanel';

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => localStorage.clear());

describe('Core Topic configuration revision (#82 GEM-82-06)', () => {
  it('hashes the inputs independent of order, case and blanks', () => {
    expect(focusConfigHash({ manualTopic: ['B', 'a'], brand: { aliases: ['X'] } })).toBe(focusConfigHash({ manualTopic: ['a', ' b '], brand: { aliases: ['x'] } }));
    expect(focusConfigHash({ businessGoal: 'sell pumps' })).not.toBe(focusConfigHash({}));
    expect(focusConfigHash({ anchorUrls: ['https://a.test/A'] })).not.toBe(focusConfigHash({ anchorUrls: ['https://a.test/a'] }));
  });

  it('notifies listeners of the saved project only, for every Core Topic input', () => {
    const own = vi.fn();
    const other = vi.fn();
    const stop = onFocusConfigChanged('p1', own);
    const stopOther = onFocusConfigChanged('p2', other);
    writeManualTopic('p1', 'insulin');
    writeAnchorUrls('p1', ['https://a.test/offer']);
    writeBusinessGoal('p1', 'sell insulin pumps');
    writeBusinessGoal('p1', '');
    writeBrandPolicy('p1', { aliases: ['Acme'] });
    expect(own).toHaveBeenCalledTimes(5);
    expect(other).not.toHaveBeenCalled();
    stop();
    stopOther();
    writeManualTopic('p1', null);
    expect(own).toHaveBeenCalledTimes(5);
    expect(onFocusConfigChanged(null, own)).toBeTypeOf('function');
  });

  it('gives dependent views a new revision as soon as the goal changes', () => {
    const { result } = renderHook(() => useFocusConfigRevision('p1'));
    const before = result.current;
    expect(before).toBe(focusConfigRevision('p1'));
    act(() => { writeBusinessGoal('p1', 'sell insulin pumps'); });
    expect(result.current).not.toBe(before);
    act(() => { window.dispatchEvent(new CustomEvent(FOCUS_CONFIG_EVENT, { detail: { projectId: 'p2' } })); });
    expect(result.current).toBe(focusConfigRevision('p1'));
  });
});

describe('brand dictionary panel (#56)', () => {
  it('saves parsed lists and explains which competitor terms were hidden', () => {
    const onSave = vi.fn();
    const report = { brandFilter: { ownBrand: ['acme'], exceptions: [], filteredGaps: [{ term: 'rival login', reason: 'competitor-brand' as const }] } };
    render(<BrandPolicyPanel report={report} saved={{ aliases: ['Acme'] }} persisted onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/Competitor brands/), { target: { value: 'Rival\nOther' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save brand terms' }));
    expect(onSave).toHaveBeenCalledWith({ aliases: ['Acme'], competitors: ['Rival', 'Other'], exceptions: [] });
    expect(screen.getByTestId('focus-brand-own').textContent).toContain('acme');
    expect(screen.getByTestId('focus-brand-filtered').textContent).toContain('rival login: a competitor brand');
  });

  it('is read-only without a project and tolerates a report without diagnostics', () => {
    render(<BrandPolicyPanel report={{}} saved={undefined} persisted={false} onSave={undefined} />);
    expect((screen.getByRole('button', { name: 'Save brand terms' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/saved per project/)).toBeTruthy();
    expect(screen.queryByTestId('focus-brand-filtered')).toBeNull();
  });
});
