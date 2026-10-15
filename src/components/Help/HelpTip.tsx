import { CircleHelp } from 'lucide-react';
import type { HelpId } from './helpTypes';
import { HelpPopover } from './HelpPopover';
import { useHelp } from './useHelp';
import { useHelpTip } from './useHelpTip';

export interface HelpTipProps {
  /** `<area>.<id>`, resolves `help.<area>.<id>.*` in the locale files. See docs/help-tips.md. */
  id: HelpId;
  className?: string;
}

/**
 * Small (?) button that opens an explanatory bubble. Place it right after the
 * label, metric or button it explains. Renders nothing when the key is missing.
 */
export const HelpTip = ({ id, className = '' }: HelpTipProps) => {
  const content = useHelp(id);
  const tip = useHelpTip();
  if (!content) return null;
  const popId = `help-${tip.uid.replace(/:/g, '')}`;

  return (
    <>
      <button
        ref={tip.buttonRef}
        type="button"
        aria-label={content.title}
        aria-expanded={tip.open}
        aria-controls={tip.open ? popId : undefined}
        aria-describedby={tip.open ? popId : undefined}
        data-help-id={id}
        {...tip.trigger}
        className={`inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-slate-500 transition-colors hover:text-emerald-300 focus-visible:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${className}`}
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {tip.open && <HelpPopover ref={tip.popoverRef} id={popId} content={content} anchor={tip.buttonRef} {...tip.hover} />}
    </>
  );
};
