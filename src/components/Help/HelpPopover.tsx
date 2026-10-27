import { forwardRef, useLayoutEffect, useState } from 'react';
import type { HTMLAttributes, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { HelpContent } from './helpTypes';
import { computePosition, type PopoverPosition } from './positionPopover';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  id: string;
  content: HelpContent;
  anchor: RefObject<HTMLElement | null>;
}

const steps = (action: string) => action.split('\n').map((line) => line.trim()).filter(Boolean);

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mt-2">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">{label}</div>
    {children}
  </div>
);

/** Portal-rendered, collision-aware bubble. Pure presentation; behaviour lives in useHelpTip. */
export const HelpPopover = forwardRef<HTMLDivElement, Props>(({ id, content, anchor, ...rest }, ref) => {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const [pos, setPos] = useState<PopoverPosition | null>(null);
  const list = steps(content.action);

  useLayoutEffect(() => {
    const box = ref && 'current' in ref ? ref.current : null;
    if (!anchor.current || !box) return undefined;
    const place = () => {
      const size = { width: box.offsetWidth, height: box.scrollHeight };
      const view = { width: window.innerWidth, height: window.innerHeight };
      setPos(computePosition(anchor.current!.getBoundingClientRect(), size, view, rtl));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, ref, rtl, content]);

  return createPortal(
    <div
      {...rest}
      ref={ref}
      id={id}
      role="tooltip"
      tabIndex={-1}
      dir={rtl ? 'rtl' : 'ltr'}
      data-placement={pos?.placement}
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden' }}
      className="fixed z-[1000] w-[min(360px,calc(100vw-16px))] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-3 text-start text-xs font-normal normal-case leading-5 tracking-normal text-slate-300 shadow-2xl focus:outline-none"
    >
      <div className="text-sm font-semibold text-white">{content.title}</div>
      <Section label={t('helpUi.what')}><p>{content.what}</p></Section>
      <Section label={t('helpUi.why')}><p>{content.why}</p></Section>
      <Section label={t('helpUi.action')}>
        {list.length > 1 ? (
          <ol className="list-decimal space-y-0.5 ps-4">{list.map((l) => <li key={l}>{l.replace(/^\d+[.)]\s*/, '')}</li>)}</ol>
        ) : <p>{list[0]}</p>}
      </Section>
      {content.example && <Section label={t('helpUi.example')}><p className="text-slate-400">{content.example}</p></Section>}
      {content.learnMore && <Section label={t('helpUi.learnMore')}><p className="text-slate-400">{content.learnMore}</p></Section>}
    </div>,
    document.body,
  );
});
HelpPopover.displayName = 'HelpPopover';
