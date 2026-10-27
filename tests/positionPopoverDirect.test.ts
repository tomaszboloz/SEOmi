import { describe, expect, it } from 'vitest';
import { computePosition, GAP, MARGIN, MIN_HEIGHT } from '@/components/Help/positionPopover';

const viewport = { width: 1000, height: 800 };

describe('computePosition', () => {
  it('places the popover below the anchor when it fits', () => {
    const r = computePosition({ top: 100, bottom: 120, left: 200, right: 240 }, { width: 300, height: 150 }, viewport, false);
    expect(r).toEqual({ top: 120 + GAP, left: 200, maxHeight: 800 - 120 - GAP - MARGIN, placement: 'bottom' });
  });

  it('flips above when there is more room above and the popover does not fit below', () => {
    const r = computePosition({ top: 600, bottom: 620, left: 200, right: 240 }, { width: 300, height: 400 }, viewport, false);
    expect(r.placement).toBe('top');
    expect(r.maxHeight).toBe(600 - GAP - MARGIN);
    expect(r.top).toBe(600 - GAP - 400);
  });

  it('keeps bottom placement when below is not smaller than above even if the popover is too tall', () => {
    const r = computePosition({ top: 300, bottom: 320, left: 0, right: 10 }, { width: 100, height: 900 }, viewport, false);
    expect(r.placement).toBe('bottom');
    expect(r.maxHeight).toBe(800 - 320 - GAP - MARGIN);
  });

  it('never shrinks below MIN_HEIGHT and clamps the top to the margin', () => {
    const r = computePosition({ top: 30, bottom: 780, left: 0, right: 10 }, { width: 100, height: 500 }, viewport, false);
    expect(r.maxHeight).toBe(MIN_HEIGHT);
    expect(r.placement).toBe('top');
    expect(r.top).toBe(MARGIN);
  });

  it('aligns to the anchor right edge in RTL and clamps horizontally to the viewport', () => {
    const rtl = computePosition({ top: 0, bottom: 10, left: 850, right: 900 }, { width: 300, height: 50 }, viewport, true);
    expect(rtl.left).toBe(600);
    expect(computePosition({ top: 0, bottom: 10, left: 950, right: 990 }, { width: 300, height: 50 }, viewport, false).left).toBe(1000 - 300 - MARGIN);
    expect(computePosition({ top: 0, bottom: 10, left: 0, right: 20 }, { width: 300, height: 50 }, viewport, true).left).toBe(MARGIN);
  });
});
