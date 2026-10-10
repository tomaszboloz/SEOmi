import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { defaultMonitoringAlertSettings, normalizeMonitoringSettings, readMonitoringSettings, saveMonitoringSettings, type MonitoringAlertSettings, type MonitoringAlertType } from '@/services/monitoringAlerts';

const types: MonitoringAlertType[] = ['gsc', 'pagespeed', 'crawl', 'semantic'];

export const MonitoringAlertsPanel = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const [settings, setSettings] = useState<MonitoringAlertSettings>(() => defaultMonitoringAlertSettings());
  useEffect(() => { setSettings(projectId ? readMonitoringSettings(projectId) : defaultMonitoringAlertSettings()); }, [projectId]);
  if (!projectId) return null;
  const update = (patch: Partial<MonitoringAlertSettings>) => {
    const next = normalizeMonitoringSettings({ ...settings, ...patch });
    setSettings(next); saveMonitoringSettings(projectId, next);
  };
  const updateThreshold = (type: MonitoringAlertType, key: string, value: number) => update({ thresholds: { ...settings.thresholds, [type]: { ...settings.thresholds[type], [key]: value } } });
  return <section aria-label={t("monitoringUi.title")} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
    <label className="flex items-start gap-3"><input type="checkbox" checked={settings.enabled} onChange={(event) => update({ enabled: event.target.checked })} aria-label={t("monitoringUi.enable")} className="mt-0.5 h-4 w-4 accent-emerald-500" /><span><span className="block font-semibold text-slate-200">{t("monitoringUi.title")}</span><span className="mt-1 block text-[11px] leading-5 text-slate-400">{t("monitoringUi.description")}</span></span></label>
    <label className="flex items-center justify-between gap-3 text-[11px] text-slate-400">{t("monitoringUi.frequency")}<select value={settings.frequency} onChange={(event) => update({ frequency: event.target.value as MonitoringAlertSettings['frequency'] })} aria-label={t("monitoringUi.frequencyAria")} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"><option value="run">{t("monitoringUi.run")}</option><option value="daily">{t("monitoringUi.daily")}</option><option value="weekly">{t("monitoringUi.weekly")}</option></select></label>
    <div className="grid gap-2 sm:grid-cols-2">{types.map((type) => <label key={type} className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={settings.types[type]} onChange={(event) => update({ types: { ...settings.types, [type]: event.target.checked } })} aria-label={t("monitoringUi.enableType", { type: t(`monitoringUi.types.${type}`) })} className="h-3.5 w-3.5 accent-emerald-500" />{t(`monitoringUi.types.${type}`)}</label>)}</div>
    <div className="grid gap-2 sm:grid-cols-2"><Field label={t("monitoringUi.gscDecline")} aria={t("monitoringUi.gscDeclineAria")} value={settings.thresholds.gsc.declinePercent} onChange={(value) => updateThreshold('gsc', 'declinePercent', value)} /><Field label={t("monitoringUi.gscMinimum")} aria={t("monitoringUi.gscMinimum")} value={settings.thresholds.gsc.minImpressions} onChange={(value) => updateThreshold('gsc', 'minImpressions', value)} /><Field label={t("monitoringUi.psiDrop")} aria={t("monitoringUi.psiDrop")} min="0.01" step="0.01" value={settings.thresholds.pagespeed.categoryDrop} onChange={(value) => updateThreshold('pagespeed', 'categoryDrop', value)} /><Field label={t("monitoringUi.crawlChanged")} aria={t("monitoringUi.crawlChanged")} value={settings.thresholds.crawl.changedPages} onChange={(value) => updateThreshold('crawl', 'changedPages', value)} /><Field label={t("monitoringUi.semanticChanged")} aria={t("monitoringUi.semanticChanged")} value={settings.thresholds.semantic.changes} onChange={(value) => updateThreshold('semantic', 'changes', value)} /></div>
  </section>;
};

const Field = ({ label, aria, value, onChange, min = '1', step = '1' }: { label: string; aria: string; value: number; onChange: (value: number) => void; min?: string; step?: string }) => <label className="text-[11px] text-slate-400">{label}<input type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={aria} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200" /></label>;
