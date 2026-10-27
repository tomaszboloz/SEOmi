import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { formatUsd, useDataForSeoCost } from '@/components/DataForSEO/cost/useDataForSeoCost';
import { DATAFORSEO_COST_EVENT } from '@/services/dataforseo/dataforseoBudget';

describe('useDataForSeoCost and formatUsd direct assertions', () => {
  it('formatUsd formats fractions of a cent with 4 decimal digits and regular amounts with 2', () => {
    const formattedFraction = formatUsd(0.0025, 'en-US');
    expect(formattedFraction).toBe('$0.0025');

    const formattedWhole = formatUsd(10.5, 'en-US');
    expect(formattedWhole).toBe('$10.50');

    const formattedZero = formatUsd(0, 'en-US');
    expect(formattedZero).toBe('$0.00');
  });

  it('useDataForSeoCost hook initializes cleanly and listens to cost events', () => {
    const { result, unmount } = renderHook(() => useDataForSeoCost());
    expect(result.current).toBeDefined();

    act(() => {
      window.dispatchEvent(new Event(DATAFORSEO_COST_EVENT));
    });

    expect(result.current.projectId).toBeDefined();
    unmount();
  });
});
