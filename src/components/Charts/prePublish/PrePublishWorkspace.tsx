import { useTranslation } from 'react-i18next';
import type { CrawlRunRecord } from '@/types';
import { PrePublishPanel } from '@/components/Charts/PrePublishPanel';
import { usePrePublish } from './usePrePublish';

export default function PrePublishWorkspace({ projectId, runs }: { projectId: string | null; runs: CrawlRunRecord[] }) {
  const { t } = useTranslation();
  const check = usePrePublish(projectId, runs);
  const label = (key: string) => t(`prePublishMountUi.${key}`);
  return <section className="space-y-4 rounded-xl border border-slate-800 p-4" aria-label={label('title')}>
    <h3 className="text-sm font-semibold text-slate-100">{label('title')}</h3>
    <p className="text-xs text-slate-400">{label('description')}</p>
    {!check.context.run && <p role="status">{label('noCrawl')}</p>}
    {check.context.run && !check.context.coreText && <p role="status">{label('noCore')}</p>}
    <label className="block text-xs text-slate-300">{label('draft')}
      <textarea value={check.text} onChange={(event) => check.changeText(event.target.value)} rows={8}
        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
    </label>
    <label className="block text-xs text-slate-300">{label('url')}
      <input type="url" value={check.url} onChange={(event) => check.changeUrl(event.target.value)}
        aria-invalid={check.invalidUrl} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
    </label>
    <p className="text-xs text-slate-400">{label('urlHint')}</p>
    {check.invalidUrl && <p role="alert">{label('invalidUrl')}</p>}
    <button type="button" onClick={check.run}
      disabled={!check.context.run || !check.text.trim() || check.invalidUrl || check.status === 'running'}
      className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-50">{label('run')}</button>
    {check.status === 'running' && <button type="button" onClick={check.cancel}
      className="ml-2 rounded border border-slate-700 px-3 py-2 text-xs text-slate-200">{label('cancel')}</button>}
    {!['idle', 'done'].includes(check.status) && <p role="status">{label(check.status)}</p>}
    {check.report && <PrePublishPanel report={check.report} />}
  </section>;
}
