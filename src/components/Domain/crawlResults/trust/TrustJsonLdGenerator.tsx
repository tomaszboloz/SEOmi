import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '@/services/clipboard';
import { buildTrustJsonLd, type TrustJsonLdInput } from '@/services/eeatTrust';
import { FOCUS_RING } from './trustHelpers';

export interface TrustJsonLdGeneratorProps { initial: TrustJsonLdInput; onClose: () => void }

type TextField = 'personName' | 'jobTitle' | 'personUrl' | 'organizationName' | 'organizationUrl' | 'pageUrl' | 'dateModified' | 'lastReviewed';
const FIELDS: TextField[] = ['personName', 'jobTitle', 'personUrl', 'organizationName', 'organizationUrl', 'pageUrl', 'dateModified', 'lastReviewed'];
const input = 'rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100';

/** Fixes missing author entity markup: Person with sameAs plus the page naming them as author or reviewer. */
export const TrustJsonLdGenerator = ({ initial, onClose }: TrustJsonLdGeneratorProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<TrustJsonLdInput>(initial);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  const result = useMemo(() => buildTrustJsonLd(form), [form]);
  const set = (patch: Partial<TrustJsonLdInput>) => { setForm((current) => ({ ...current, ...patch })); setCopied('idle'); };
  const copy = async () => setCopied((await copyText(`<script type="application/ld+json">\n${result.text}\n</script>`)) ? 'ok' : 'failed');
  return (
    <section aria-labelledby="trust-gen-title" className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between">
        <h2 id="trust-gen-title" className="text-sm font-semibold text-slate-200">{t('trust.generator.title')}</h2>
        <button type="button" onClick={onClose} className={`rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 ${FOCUS_RING}`}>{t('trust.generator.close')}</button>
      </div>
      <p className="text-xs text-slate-400">{t('trust.generator.intro')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field} className="flex flex-col gap-1 text-xs text-slate-300">
            {t(`trust.generator.field.${field}`)}
            <input className={input} value={form[field] ?? ''} onChange={(event) => set({ [field]: event.target.value })} />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-xs text-slate-300 sm:col-span-2">
          {t('trust.generator.field.sameAs')}
          <textarea className={input} rows={3} value={form.sameAs.join('\n')} onChange={(event) => set({ sameAs: event.target.value.split('\n') })} />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={Boolean(form.asReviewer)} onChange={(event) => set({ asReviewer: event.target.checked })} />
          {t('trust.generator.field.asReviewer')}
        </label>
      </div>
      {result.issues.length > 0 && (
        <ul role="alert" className="list-disc ps-5 text-xs text-amber-200">
          {result.issues.map((issue) => <li key={issue}>{t(`trust.generator.issue.${issue}`)}</li>)}
        </ul>
      )}
      <pre aria-label={t('trust.generator.preview')} className="max-h-64 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-200">{result.text}</pre>
      <div className="flex items-center gap-3">
        <button type="button" onClick={copy} disabled={!result.ok} className={`rounded border border-emerald-500 px-3 py-1 text-xs text-emerald-200 disabled:opacity-50 ${FOCUS_RING}`}>{t('trust.generator.copy')}</button>
        {copied !== 'idle' && <p role="status" className="text-xs text-slate-300">{t(copied === 'ok' ? 'trust.generator.copied' : 'trust.generator.copyFailed')}</p>}
      </div>
    </section>
  );
};
