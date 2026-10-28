import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LinkInjection } from '@/services/linkInjector';
import { copyText } from '@/services/clipboard';

type Format = 'html' | 'markdown';

const gainText = (value: number | null, t: (key: string, options?: Record<string, unknown>) => string): string =>
  value === null ? t('linkInjector.gainUnknown') : t('linkInjector.gain', { value: `${value > 0 ? '+' : ''}${value.toFixed(1)}` });

/** Top contextual link injections (#128): where to place the link in the donor and the ready sentence. */
export const ContextualLinkInjectorPanel = ({ injections }: { injections: LinkInjection[] }) => {
  const { t } = useTranslation();
  const [format, setFormat] = useState<Format>('html');
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (item: LinkInjection) => {
    const ok = await copyText(format === 'html' ? item.html : item.markdown);
    setCopied(ok ? item.id : null);
  };

  return (
    <section aria-labelledby="link-injector-title" className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 id="link-injector-title" className="text-sm font-semibold text-slate-100">{t('linkInjector.title')}</h4>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">{t('linkInjector.description')}</p>
        </div>
        <fieldset className="flex gap-1 text-[11px]">
          <legend className="sr-only">{t('linkInjector.format')}</legend>
          {(['html', 'markdown'] as const).map((value) => (
            <label key={value} className={`cursor-pointer rounded border px-2 py-1 ${format === value ? 'border-emerald-400 text-emerald-200' : 'border-slate-700 text-slate-400'}`}>
              <input type="radio" name="link-injector-format" value={value} checked={format === value} onChange={() => setFormat(value)} className="sr-only" />
              {value === 'html' ? 'HTML' : 'Markdown'}
            </label>
          ))}
        </fieldset>
      </header>
      {!injections.length ? (
        <p className="mt-3 rounded-md border border-dashed border-slate-800 p-5 text-center text-xs text-slate-500">{t('linkInjector.empty')}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {injections.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs">
              <p className="text-slate-300">
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-sky-200 hover:underline">{item.sourceTitle}</a>
                <span aria-hidden="true" className="px-1 text-slate-600">→</span>
                <a href={item.targetUrl} target="_blank" rel="noreferrer" className="font-medium text-sky-200 hover:underline">{item.targetTitle}</a>
              </p>
              <p className="mt-1 text-slate-400">{t('linkInjector.section', { level: item.section.level, heading: item.section.heading, hits: item.section.termHits })}</p>
              <p className="mt-1 text-slate-400">{gainText(item.expectedSprGain, t)}</p>
              {item.languageFallback && <p className="mt-1 text-amber-200">{t('linkInjector.languageFallback')}</p>}
              <div className="mt-2 flex flex-wrap items-start gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-200" lang={item.language}>
                  {format === 'html' ? item.html : item.markdown}
                </code>
                <button type="button" onClick={() => void copy(item)} className="rounded border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                  {copied === item.id ? t('linkInjector.copied') : t('linkInjector.copy')}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
