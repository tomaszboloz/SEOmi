import { Copy, Loader2, Play, Server, ShieldCheck, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getRenderWorkerStatus,
  isTauriEnvironment,
  startRenderWorker,
  stopRenderWorker,
  type RenderWorkerLease,
} from '@/services/tauri';
import { copyText } from '@/services/clipboard';
import { renderWorkerLeaseDelay } from '@/services/renderWorkerLease';
export const RenderWorkerPanel = () => {
  const { t } = useTranslation();
  const operation = useRef(0);
  const [lease, setLease] = useState<RenderWorkerLease | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    let disposed = false;
    const refreshStatus = async () => {
      const revision = operation.current;
      try {
        const nextActive = await getRenderWorkerStatus();
        if (disposed || revision !== operation.current) return;
        setActive(nextActive);
        if (!nextActive && lease) {
          setLease(null);
          setMessage(t('legacyUi.renderWorker.sessionExpired')); 
        }
      } catch {
        if (!disposed && revision === operation.current) setActive(false);
      }
    };
    void refreshStatus();
    const interval = window.setInterval(() => void refreshStatus(), 5_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [lease]);
  useEffect(() => {
    if (!lease) return;
    const delay = renderWorkerLeaseDelay(lease.expiresAt);
    if (delay === null) return;
    const timer = window.setTimeout(() => {
      setLease(null);
      setActive(false);
      setMessage(t('legacyUi.renderWorker.leaseExpired'));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [lease]);
  const start = async () => {
    if (!isTauriEnvironment()) {
      setMessage(t('legacyUi.renderWorker.desktopRequired'));
      return;
    }
    operation.current += 1;
    setBusy(true);
    setMessage(null);
    try {
      setLease(await startRenderWorker());
      setActive(true);
      setMessage(t('legacyUi.renderWorker.started'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    operation.current += 1;
    setBusy(true);
    try {
      await stopRenderWorker();
      setLease(null);
      setActive(false);
      setMessage(t('legacyUi.renderWorker.stopped'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async () => {
    if (!lease) return;
    try {
      const copied = await copyText(lease.token);
      setMessage(copied ? t('legacyUi.renderWorker.tokenCopied') : t('legacyUi.renderWorker.tokenCopyFailed'));
    } catch {
      setMessage(t('legacyUi.renderWorker.tokenCopyFailed'));
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4" data-testid="render-worker-panel">
      <div className="flex items-start gap-3">
        <Server className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-slate-200">{t('legacyUi.renderWorker.title')}</h4>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">
            {t('legacyUi.renderWorker.description')}
          </p>
        </div>
        {!active ? (
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy || !isTauriEnvironment()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-sky-400/30 bg-sky-400/10 px-2.5 py-1.5 text-[11px] font-medium text-sky-200 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {t('legacyUi.renderWorker.start')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void stop()}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-rose-400/30 bg-rose-400/10 px-2.5 py-1.5 text-[11px] font-medium text-rose-200 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
            {t('legacyUi.renderWorker.stop')}
          </button>
        )}
      </div>
      {lease && (
        <div className="mt-3 grid gap-2 rounded-lg border border-sky-400/20 bg-sky-400/5 p-3 text-[11px] text-slate-300 sm:grid-cols-2">
          <p><span className="text-slate-500">{t('legacyUi.renderWorker.address')}:</span> <code className="break-all text-sky-200">{lease.baseUrl}</code></p>
          <p><span className="text-slate-500">{t('legacyUi.renderWorker.version')}:</span> <code className="text-sky-200">{lease.version}</code></p>
          <p className="sm:col-span-2"><span className="text-slate-500">{t('legacyUi.renderWorker.oneTimeToken')}:</span> <code className="break-all text-slate-200">{lease.token}</code></p>
          <p className="sm:col-span-2 text-slate-500">{t('legacyUi.renderWorker.health')}: <code>{lease.baseUrl}{t('uiUnits.healthEndpoint')}</code> · {t('legacyUi.renderWorker.expires')} {lease.expiresAt}</p>
          <button type="button" onClick={() => void copyToken()} className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-800 hover:text-white" aria-label={t('legacyUi.renderWorker.copyToken')}>
            <Copy className="h-3.5 w-3.5" />{t('legacyUi.renderWorker.copyToken')}
          </button>
          <p className="flex items-center gap-1.5 text-[10px] text-amber-200"><ShieldCheck className="h-3.5 w-3.5" />{t('legacyUi.renderWorker.keepTokenPrivate')}</p>
        </div>
      )}
      {active && !lease && <p className="mt-3 text-[11px] text-amber-200">{t('legacyUi.renderWorker.activeWithoutToken')}</p>}
      {message && <p role="status" className="mt-2 text-[11px] text-slate-400">{message}</p>}
    </section>
  );
};
