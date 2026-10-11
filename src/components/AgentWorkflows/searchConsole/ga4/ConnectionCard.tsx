import type { Ga4T } from './viewTypes';

interface Props {
  connected: boolean;
  loading: boolean;
  hasClientId: boolean;
  clientSecret: string;
  setClientSecret: (value: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
  t: Ga4T;
}

export function Ga4ConnectionCard({ connected, loading, hasClientId, clientSecret, setClientSecret, onConnect, onRefresh, t }: Props) {
  return <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
    <div>
      <h2 className="font-semibold text-white">{t('ga4.title')}</h2>
      <p className="text-xs text-slate-400">{t('ga4.description')}</p>
    </div>
    {!hasClientId && <p role="note" className="text-xs text-amber-300">{t('ga4.connectFirst')}</p>}
    <label className="flex flex-col gap-1 text-xs text-slate-300">
      {t('ga4.clientSecret')}
      <input type="password" autoComplete="off" value={clientSecret} onChange={(event) => setClientSecret(event.currentTarget.value)} placeholder="••••••••" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
      <span className="text-[11px] text-slate-500">{t('ga4.clientSecretHint')}</span>
    </label>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={loading || !hasClientId} onClick={onConnect} className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200 border border-emerald-500/30 disabled:opacity-40">
        {loading ? t('ga4.loading') : connected ? t('ga4.reconnect') : t('ga4.authorize')}
      </button>
      {connected && <button type="button" disabled={loading} onClick={onRefresh} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-40">{t('ga4.refresh')}</button>}
    </div>
  </section>;
}
