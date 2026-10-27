import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const WEIGHT_ROWS = [
  { key: 'weightHome', width: 'w-full', tone: 'bg-emerald-500' },
  { key: 'weightCategory', width: 'w-2/3', tone: 'bg-sky-500' },
  { key: 'weightArticle', width: 'w-1/3', tone: 'bg-slate-500' },
] as const;

export const FocusDrawer = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60" onClick={onClose} data-testid="focus-drawer-backdrop">
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-drawer-title"
        className="h-full w-full max-w-md space-y-4 overflow-y-auto border-s border-slate-800 bg-slate-900 p-5 text-sm text-slate-300 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="focus-drawer-title" className="text-base font-semibold text-slate-100">{t('focus.drawer.title')}</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label={t('focus.drawer.close')}
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <section aria-labelledby="focus-drawer-weights" className="space-y-2">
          <h3 id="focus-drawer-weights" className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('focus.drawer.weights')}</h3>
          <ul className="space-y-2">
            {WEIGHT_ROWS.map((row) => (
              <li key={row.key}>
                <div className="h-2 rounded bg-slate-800" aria-hidden="true"><div className={`h-2 rounded ${row.width} ${row.tone}`} /></div>
                <p className="mt-1 text-xs">{t(`focus.drawer.${row.key}`)}</p>
              </li>
            ))}
          </ul>
          <p className="rounded bg-slate-950/60 p-2 font-mono text-xs text-slate-200">{t('focus.drawer.sfsFormula')}</p>
        </section>
        <section aria-labelledby="focus-drawer-trs" className="space-y-2">
          <h3 id="focus-drawer-trs" className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('focus.drawer.trsTitle')}</h3>
          <p className="rounded bg-slate-950/60 p-2 font-mono text-xs text-slate-200">{t('focus.drawer.trsFormula')}</p>
          <p className="rounded bg-slate-950/60 p-2 font-mono text-xs text-slate-200">{t('focus.drawer.trsLexical')}</p>
          <p className="text-xs">{t('focus.drawer.bands')}</p>
          <p className="text-xs">{t('focus.drawer.onTopic')}</p>
        </section>
      </aside>
    </div>
  );
};
