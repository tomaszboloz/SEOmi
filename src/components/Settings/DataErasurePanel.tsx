import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { isTauriEnvironment } from '@/services/tauri';
import { eraseProjectData } from '@/services/dataErasure';

type Status = { kind: 'done'; records: number; runs: number } | { kind: 'failed'; message: string } | null;

/** GDPR erasure of the active project's local data (crypto-shredding). Needs the project ID typed to confirm. */
export const DataErasurePanel: React.FC = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore((s) => s.activeProjectId);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const desktop = isTauriEnvironment();
  const reset = () => { setConfirming(false); setTyped(''); };

  const run = async () => {
    // The confirm button stays disabled until the typed text equals the active project ID.
    setBusy(true);
    try {
      const report = await eraseProjectData(projectId as string);
      setStatus({ kind: 'done', records: report.recordsDeleted, runs: report.runsDeleted });
    } catch (error) {
      setStatus({ kind: 'failed', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      reset();
    }
  };

  return (
    <section aria-label={t('dataErasureUi.title')} className="space-y-2 rounded-xl border border-red-500/30 bg-slate-950/60 p-4">
      <h3 className="flex items-center gap-2 font-semibold text-red-300"><Trash2 className="h-4 w-4" />{t('dataErasureUi.title')}</h3>
      <p className="text-[11px] leading-5 text-slate-400">{t('dataErasureUi.description')}</p>
      {!desktop && <p className="text-[11px] text-slate-500">{t('dataErasureUi.desktopOnly')}</p>}
      {!confirming ? (
        <button type="button" disabled={!projectId || !desktop || busy} onClick={() => setConfirming(true)} className="rounded-md border border-red-500/40 px-3 py-1.5 text-red-300 disabled:opacity-40">
          {t('dataErasureUi.button')}
        </button>
      ) : (
        <div className="space-y-2">
          <label className="block text-[11px] text-slate-300">
            {t('dataErasureUi.confirm', { id: projectId })}
            <input value={typed} onChange={(event) => setTyped(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 font-mono text-xs text-white" />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy || typed !== projectId} onClick={run} className="rounded-md bg-red-600 px-3 py-1.5 text-white disabled:opacity-40">{t('dataErasureUi.run')}</button>
            <button type="button" disabled={busy} onClick={reset} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300">{t('dataErasureUi.cancel')}</button>
          </div>
        </div>
      )}
      {status?.kind === 'done' && <p role="status" className="text-[11px] text-emerald-300">{t('dataErasureUi.done', { records: status.records, runs: status.runs })}</p>}
      {status?.kind === 'failed' && <p role="alert" className="text-[11px] text-red-300">{t('dataErasureUi.failed', { message: status.message })}</p>}
    </section>
  );
};
