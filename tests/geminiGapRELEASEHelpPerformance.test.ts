import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useHelp } from '@/components/Help/useHelp';
import type { HelpId } from '@/components/Help/helpTypes';
import { CLOSE_DELAY_MS, OPEN_DELAY_MS, useHelpTip } from '@/components/Help/useHelpTip';
import { useHelpStore } from '@/components/Help/helpStore';
import { cruxCategory } from '@/components/Performance/cruxEvidence';

describe('RELEASE help and performance branch coverage', () => {
  const originalDev = import.meta.env.DEV;
  const originalMode = import.meta.env.MODE;

  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    import.meta.env.DEV = originalDev;
    import.meta.env.MODE = originalMode;
    vi.restoreAllMocks();
    vi.useRealTimers();
    useHelpStore.setState({ openId: null });
  });

  it('covers useHelp line 14 dev/mode warn branches and valid help resolution', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // DEV=true, MODE='development' -> logs warning for missing/incomplete key
    import.meta.env.DEV = true;
    import.meta.env.MODE = 'development';
    const { result: devResult, unmount: uDev } = renderHook(() => useHelp('aio.missingEntry' as HelpId));
    expect(devResult.current).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[help] missing or incomplete help entry "help.aio.missingEntry"');
    uDev();

    // DEV=true, MODE='test' -> suppresses warning
    warnSpy.mockClear();
    import.meta.env.MODE = 'test';
    const { result: testResult, unmount: uTest } = renderHook(() => useHelp('aio.missingEntry' as HelpId));
    expect(testResult.current).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    uTest();

    // DEV=false -> suppresses warning
    import.meta.env.DEV = false;
    import.meta.env.MODE = 'production';
    const { result: prodResult, unmount: uProd } = renderHook(() => useHelp('aio.missingEntry' as HelpId));
    expect(prodResult.current).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    uProd();

    // Valid help entry using genuine locale data
    const { result: validResult, unmount: uValid } = renderHook(() => useHelp('aio.aioReadiness'));
    expect(validResult.current).not.toBeNull();
    expect(validResult.current?.title).toBe('AI readiness score (AIO-R)');
    expect(validResult.current?.what).toContain('0-100 measure');
    uValid();
  });

  it('covers useHelpTip line 54 open vs closed pointer enter branches', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useHelpTip());
    expect(result.current.open).toBe(false);

    // Touch pointer type returns early without setting timers
    result.current.trigger.onPointerEnter({ pointerType: 'touch' } as never);
    expect(useHelpStore.getState().openId).toBeNull();

    // Closed: schedules timer and opens after OPEN_DELAY_MS
    result.current.trigger.onPointerEnter({ pointerType: 'mouse' } as never);
    act(() => { vi.advanceTimersByTime(OPEN_DELAY_MS); });
    expect(useHelpStore.getState().openId).toBe(result.current.uid);
    expect(result.current.open).toBe(true);

    // Open: pointer enter branch evaluates (!open === false), does not schedule open timer
    result.current.trigger.onPointerEnter({ pointerType: 'mouse' } as never);
    expect(useHelpStore.getState().openId).toBe(result.current.uid);

    // Pointer leave hides after CLOSE_DELAY_MS
    result.current.trigger.onPointerLeave({ pointerType: 'mouse' } as never);
    act(() => { vi.advanceTimersByTime(CLOSE_DELAY_MS); });
    expect(useHelpStore.getState().openId).toBeNull();
    unmount();
  });

  it('covers cruxCategory line 46 hasOwnProperty branches for thresholds', () => {
    // Known metric threshold categories using application translator
    expect(cruxCategory({ metric: 'largest_contentful_paint', percentiles: { p75: 2000 } }, i18n.t)).toBe('Good');
    expect(cruxCategory({ metric: 'largest_contentful_paint', percentiles: { p75: 3500 } }, i18n.t)).toBe('Needs improvement');
    expect(cruxCategory({ metric: 'largest_contentful_paint', percentiles: { p75: 4500 } }, i18n.t)).toBe('Poor');

    // Unknown metric name -> bounds undefined -> Unrated
    expect(cruxCategory({ metric: 'unknown_metric_gap', percentiles: { p75: 100 } }, i18n.t)).toBe('Unrated');

    // metric is undefined -> fallback '' -> does NOT have own property -> bounds undefined -> Unrated
    expect(cruxCategory({ metric: undefined, percentiles: { p75: 100 } }, i18n.t)).toBe('Unrated');

    // null percentile value -> Unrated
    expect(cruxCategory({ metric: 'largest_contentful_paint', percentiles: { p75: null } }, i18n.t)).toBe('Unrated');
  });
});
