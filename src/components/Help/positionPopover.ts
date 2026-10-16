export const MARGIN = 8;
export const GAP = 8;
export const MIN_HEIGHT = 96;

export interface AnchorBox { top: number; bottom: number; left: number; right: number }
export interface PopoverPosition { top: number; left: number; maxHeight: number; placement: 'top' | 'bottom' }

/**
 * Pure viewport-collision placement. Prefers below the anchor, flips above when
 * there is not enough room, then shifts horizontally so the box stays inside
 * the viewport. In RTL the popover edge aligns with the anchor's right edge.
 */
export const computePosition = (
  anchor: AnchorBox,
  pop: { width: number; height: number },
  viewport: { width: number; height: number },
  rtl: boolean,
): PopoverPosition => {
  const below = viewport.height - anchor.bottom - GAP - MARGIN;
  const above = anchor.top - GAP - MARGIN;
  const placement = pop.height <= below || below >= above ? 'bottom' : 'top';
  const room = placement === 'bottom' ? below : above;
  const maxHeight = Math.max(MIN_HEIGHT, room);
  const height = Math.min(pop.height, maxHeight);
  const top = placement === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - height;
  const wanted = rtl ? anchor.right - pop.width : anchor.left;
  const left = Math.max(MARGIN, Math.min(wanted, viewport.width - pop.width - MARGIN));
  return { top: Math.max(MARGIN, top), left, maxHeight, placement };
};
