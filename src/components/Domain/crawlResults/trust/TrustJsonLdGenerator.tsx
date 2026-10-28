import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '@/services/clipboard';
import { buildTrustJsonLd, diffAgainstObserved, type TrustJsonLdInput } from '@/services/eeatTrust';
import { downloadText } from '@/services/export/download';
import { composeSchemaGraph } from '@/services/schemaGenerator';
import { FOCUS_RING } from './trustHelpers';
import { TrustJsonLdDiff } from './TrustJsonLdDiff';

export interface TrustJsonLdGeneratorProps { initial: TrustJsonLdInput; onClose: () => void; observed?: Record<string, unknown> }

type TextField = 'personName' | 'jobTitle' | 'personUrl' | 'organizationName' | 'organizationUrl' | 'pageUrl' | 'dateModified' | 'lastReviewed';
const FIELDS: TextField[] = ['personName', 'jobTitle', 'personUrl', 'organizationName', 'organizationUrl', 'pageUrl', 'dateModified', 'lastReviewed'];
type UnverifiedFormField = 'bio' | 'credential';
const UNVERIFIED: UnverifiedFormField[] = ['bio', 'credential'];
const input = 'rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100';

/** Fixes missing author entity markup: Person with sameAs plus the page naming them as author or reviewer. */
export const TrustJsonLdGenerator = ({ initial, onClose, observed }: TrustJsonLdGeneratorProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<TrustJsonLdInput>(initial);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  const [downloaded, setDownloaded] = useState<'idle' | 'ok' | 'failed'>('idle');
  const result = useMemo(() => buildTrustJsonLd(form), [form]);
  const composition = useMemo(() => composeSchemaGraph({ observed, trust: result }), [observed, result]);
  const diff = useMemo(() => diffAgainstObserved(observed, composition.schema), [observed, composition.schema]);
  const set = (patch: Partial<TrustJsonLdInput>) => { setForm((current) => ({ ...current, ...patch })); setCopied('idle'); setDownloaded('idle'); };
  const sourceOf = (field: TextField) => (form[field] !== undefined && form[field] === initial[field] ? initial.sources?.[field] : undefined);
  const download = () => { try { downloadText('trust-json-ld.json', composition.text, 'application/ld+json'); setDownloaded('ok'); } catch { setDownloaded('failed'); } };
  const copy = async () => setCopied((await copyText(composition.script)) ? 'ok' : 'failed');
  return (
    <section aria-labelledby="trust-gen-title" className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between">
        <h2 id="trust-gen-title" className="text-sm font-semibold text-slate-200">{t('trust.generator.title')}</h2>
        <button type="button" onClick={onClose} className={`rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 ${FOCUS_RING}`}>{t('trust.generator.close')}</button>
      </div>
      <p className="text-xs text-slate-400">{t('trust.generator.intro')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field} className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              {t(`trust.generator.field.${field}`)}
              <input className={input} value={form[field] ?? ''} aria-describedby={sourceOf(field) ? `trust-gen-src-${field}` : undefined} onChange={(event) => set({ [field]: event.target.value })} />
            </label>
            {sourceOf(field) && <span id={`trust-gen-src-${field}`} className="text-[10px] text-sky-300">{t('trust.generator.source', { source: t(`trust.generator.sourceName.${sourceOf(field)}`) })}</span>}
          </div>
        ))}
        <label className="flex flex-col gap-1 text-xs text-slate-300 sm:col-span-2">
          {t('trust.generator.field.sameAs')}
          <textarea className={input} rows={3} value={form.sameAs.join('\n')} onChange={(event) => set({ sameAs: event.target.value.split('\n') })} />
        </label>
        {UNVERIFIED.map((field) => (
          <div key={field} className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              {t(`trust.generator.field.${field}`)}
              <input className={input} value={form[field] ?? ''} aria-describedby={`trust-gen-verify-${field}`} onChange={(event) => set({ [field]: event.target.value })} />
            </label>
            <span id={`trust-gen-verify-${field}`} className="text-[10px] text-amber-300">{t('trust.generator.needsVerification')}</span>
          </div>
        ))}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            {t('trust.generator.field.knowsAbout')}
            <textarea className={input} rows={2} value={(form.knowsAbout ?? []).join('\n')} aria-describedby="trust-gen-verify-knowsAbout" onChange={(event) => set({ knowsAbout: event.target.value.split('\n') })} />
          </label>
          <span id="trust-gen-verify-knowsAbout" className="text-[10px] text-amber-300">{t('trust.generator.needsVerification')}</span>
        </div>
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
      {composition.conflicts.length > 0 && <ul role="alert" className="list-disc ps-5 text-xs text-rose-200">{composition.conflicts.map((conflict) => <li key={`${conflict.id}:${conflict.property}`}>{t('trust.generator.issue.conflict', { id: conflict.id, property: conflict.property })}</li>)}</ul>}
      <pre aria-label={t('trust.generator.preview')} className="max-h-64 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-200">{composition.text}</pre>
      {result.needsVerification.length > 0 && <p role="note" className="text-xs text-amber-200">{t('trust.generator.unverifiedNote', { fields: result.needsVerification.join(', ') })}</p>}
      <TrustJsonLdDiff diff={diff} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={copy} disabled={!result.ok} className={`rounded border border-emerald-500 px-3 py-1 text-xs text-emerald-200 disabled:opacity-50 ${FOCUS_RING}`}>{t('trust.generator.copy')}</button>
        <button type="button" onClick={download} disabled={!result.ok} className={`rounded border border-sky-500 px-3 py-1 text-xs text-sky-200 disabled:opacity-50 ${FOCUS_RING}`}>{t('trust.generator.download')}</button>
        {downloaded !== 'idle' && <p role="status" className="text-xs text-slate-300">{t(downloaded === 'ok' ? 'trust.generator.downloaded' : 'trust.generator.downloadFailed')}</p>}
        {copied !== 'idle' && <p role="status" className="text-xs text-slate-300">{t(copied === 'ok' ? 'trust.generator.copied' : 'trust.generator.copyFailed')}</p>}
      </div>
    </section>
  );
};
