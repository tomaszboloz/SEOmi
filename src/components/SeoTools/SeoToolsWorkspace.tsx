import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Loader2, Search, Wrench } from 'lucide-react';
import { BacklinkChecker } from '@/components/Domain/BacklinkChecker';
import { DomainOverview } from '@/components/Domain/DomainOverview';
import { KeywordResearch } from '@/components/Keywords/KeywordResearch';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { readStorage, writeStorage } from '@/services/storage';
import { appLocale } from '@/services/localeFormat';

type SeoToolId =
  | 'competitor-analysis'
  | 'competitor-keywords'
  | 'keyword-generator'
  | 'serp-simulator'
  | 'domain-age'
  | 'spam-score'
  | 'traffic-checker';

const toolIds: readonly SeoToolId[] = [
  'competitor-analysis',
  'competitor-keywords',
  'keyword-generator',
  'serp-simulator',
  'domain-age',
  'spam-score',
  'traffic-checker',
];

const tabStorageKey = (projectId: string) => `seomi_project_${projectId}_seo_tools_tab_v1`;
const simulatorStorageKey = (projectId: string) => `seomi_project_${projectId}_seo_simulator_v1`;
const domainAgeInputStorageKey = (projectId: string) => `seomi_project_${projectId}_seo_domain_age_input_v1`;
const competitorKeywordsInputStorageKey = (projectId: string) => `seomi_project_${projectId}_seo_competitor_keywords_input_v1`;

const isSeoToolId = (value: string | null): value is SeoToolId => Boolean(value && toolIds.includes(value as SeoToolId));

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapDomain {
  ldhName?: string;
  status?: string[];
  events?: RdapEvent[];
  links?: Array<{ href?: string }>;
}

const domainFromInput = (value: string): string => {
  const trimmed = value.trim();
  const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('invalid');
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || !hostname.includes('.') || hostname.includes(':')) throw new Error('invalid');
  return hostname;
};

const ageInDays = (date: string): number | null => {
  const parsed = Date.parse(date);
  if (!Number.isFinite(parsed) || parsed > Date.now()) return null;
  return Math.floor((Date.now() - parsed) / 86_400_000);
};

const PanelHeader: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <header className="border-b border-slate-800 px-5 py-5 sm:px-7">
    <div className="flex items-start gap-3">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-300">
        <Wrench className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{description}</p>
      </div>
    </div>
  </header>
);

const DomainAgePanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) => state.projects.find((item) => item.id === state.activeProjectId));
  const [domain, setDomain] = useState(project?.rootUrl || '');
  const [record, setRecord] = useState<RdapDomain | null>(null);
  const [registrationDate, setRegistrationDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestToken = useRef(0);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    requestToken.current += 1;
    requestController.current?.abort();
    requestController.current = null;
    setDomain(projectId ? ((readStorage(domainAgeInputStorageKey(projectId)) ?? project?.rootUrl) || '') : '');
    setRecord(null);
    setRegistrationDate(null);
    setError(null);
    setLoading(false);
    return () => {
      requestToken.current += 1;
      requestController.current?.abort();
      requestController.current = null;
    };
  }, [projectId, project?.rootUrl]);

  const check = async () => {
    let hostname: string;
    try {
      hostname = domainFromInput(domain);
    } catch {
      setError(t('seoTools.invalidDomain'));
      return;
    }
    const token = ++requestToken.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setRecord(null);
    setRegistrationDate(null);
    setError(null);
    try {
      const timeout = globalThis.setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch(`https://rdap.org/domain/${encodeURIComponent(hostname)}`, {
          headers: { Accept: 'application/rdap+json, application/json' },
          signal: controller.signal,
        });
      } finally {
        globalThis.clearTimeout(timeout);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as RdapDomain;
      const registration = (payload.events || []).find((event) => event.eventAction.toLowerCase() === 'registration');
      if (requestToken.current !== token) return;
      setRecord(payload);
      setRegistrationDate(registration?.eventDate || null);
      if (!registration) setError(t('seoTools.rdapUnavailable'));
    } catch (cause) {
      if (requestToken.current !== token) return;
      setError(cause instanceof Error && cause.message.startsWith('HTTP') ? t('seoTools.lookupFailed', { error: cause.message }) : t('seoTools.lookupFailed', { error: t('seoTools.rdapUnavailable') }));
    } finally {
      if (requestToken.current === token) {
        requestController.current = null;
        setLoading(false);
      }
    }
  };

  const days = registrationDate ? ageInDays(registrationDate) : null;
  const formattedDate = registrationDate
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(registrationDate))
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="seo-tools-domain-age-input">{t('seoTools.domainInput')}</label>
        <input id="seo-tools-domain-age-input" value={domain} onChange={(event) => { const next = event.target.value; setDomain(next); if (projectId) writeStorage(domainAgeInputStorageKey(projectId), next); }} placeholder={t('seoTools.domainPlaceholder')} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400" />
        <button type="button" onClick={() => void check()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          {loading ? t('seoTools.loading') : t('seoTools.lookup')}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200">{error}</p>}
      {record && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{t('seoTools.domain')}</p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-100">{record.ldhName || domain}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{t('seoTools.registrationDate')}</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{formattedDate || t('seoTools.notAvailable')}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{t('seoTools.domainAge')}</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{days === null ? t('seoTools.notAvailable') : t('seoTools.ageDays', { count: days })}</p>
          </div>
        </div>
      )}
      <p className="text-[11px] leading-5 text-slate-500">{t('seoTools.rdapNote')}</p>
    </div>
  );
};

const CompetitorKeywordsPanel: React.FC = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) => state.projects.find((item) => item.id === state.activeProjectId));
  const domainOverview = useToolsStore((state) => state.domainOverview);
  const domainError = useToolsStore((state) => state.domainError);
  const isLoading = useToolsStore((state) => state.isDomainLoading);
  const analyzeDomain = useToolsStore((state) => state.analyzeDomain);
  const [domain, setDomain] = useState(project?.rootUrl || '');

  useEffect(() => {
    setDomain(projectId ? ((readStorage(competitorKeywordsInputStorageKey(projectId)) ?? project?.rootUrl) || '') : '');
  }, [projectId, project?.rootUrl]);

  const keywords = domainOverview?.domain === domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
    ? domainOverview.top_keywords
    : [];

  return (
    <div className="space-y-5">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void analyzeDomain(domain); }}>
        <label className="sr-only" htmlFor="seo-tools-competitor-keywords-input">{t('seoTools.competitorDomain')}</label>
        <input id="seo-tools-competitor-keywords-input" value={domain} onChange={(event) => { const next = event.target.value; setDomain(next); if (projectId) writeStorage(competitorKeywordsInputStorageKey(projectId), next); }} placeholder={t('seoTools.domainPlaceholder')} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400" />
        <button type="submit" disabled={isLoading || !domain.trim()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{isLoading ? t('seoTools.loading') : t('seoTools.loadKeywords')}</button>
      </form>
      {domainError && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-200">{domainError}</p>}
      {!isLoading && !domainError && !keywords.length && <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs leading-5 text-slate-400">{t('seoTools.noKeywords')}</p>}
      {keywords.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400"><tr><th className="px-3 py-2">{t('seoTools.keyword')}</th><th className="px-3 py-2">{t('seoTools.position')}</th><th className="px-3 py-2">{t('seoTools.volume')}</th><th className="px-3 py-2">{t('seoTools.intent')}</th></tr></thead>
            <tbody>{keywords.map((item) => <tr key={`${item.keyword}-${item.position}`} className="border-t border-slate-800 text-slate-200"><td className="px-3 py-2">{item.keyword}</td><td className="px-3 py-2">{item.position ?? t('seoTools.notAvailable')}</td><td className="px-3 py-2">{item.search_volume ?? t('seoTools.notAvailable')}</td><td className="px-3 py-2">{item.intent || t('seoTools.notAvailable')}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] leading-5 text-slate-500">{t('seoTools.liveOnly')}</p>
    </div>
  );
};

const TrafficCheckerPanel: React.FC = () => {
  const { t } = useTranslation();
  const project = useProjectStore((state) => state.projects.find((item) => item.id === state.activeProjectId));
  const domainQuery = useToolsStore((state) => state.domainQuery);
  const domainOverview = useToolsStore((state) => state.domainOverview);
  const isLoading = useToolsStore((state) => state.isDomainLoading);
  const error = useToolsStore((state) => state.domainError);
  const setDomainQuery = useToolsStore((state) => state.setDomainQuery);
  const analyzeDomain = useToolsStore((state) => state.analyzeDomain);

  useEffect(() => {
    if (!domainQuery.trim() && project?.rootUrl) setDomainQuery(project.rootUrl);
  }, [domainQuery, project?.rootUrl, setDomainQuery]);

  const run = (event: React.FormEvent) => {
    event.preventDefault();
    if (domainQuery.trim()) void analyzeDomain(domainQuery.trim());
  };

  const metrics = domainOverview
    ? [
        {
          label: t('domainResearchUi.monthlyTraffic'),
          value: domainOverview.organic_traffic?.toLocaleString(appLocale()) ?? '—',
          detail: t('domainResearchUi.estimatedVisitors'),
        },
        {
          label: t('domainResearchUi.organicKeywords'),
          value: domainOverview.organic_keywords?.toLocaleString(appLocale()) ?? '—',
          detail: t('domainResearchUi.rankedTop100'),
        },
        {
          label: t('domainResearchUi.referringDomains'),
          value: domainOverview.referring_domains?.toLocaleString(appLocale()) ?? '—',
          detail: t('domainResearchUi.uniqueRootDomains'),
        },
        {
          label: t('domainResearchUi.domainRank'),
          value: domainOverview.domain_rank?.toLocaleString(appLocale()) ?? '—',
          detail: t('domainResearchUi.authorityStrength'),
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={run}>
        <label className="sr-only" htmlFor="seo-tools-traffic-input">{t('seoTools.domainInput')}</label>
        <input
          id="seo-tools-traffic-input"
          value={domainQuery}
          onChange={(event) => setDomainQuery(event.target.value)}
          placeholder={t('seoTools.domainPlaceholder')}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400"
        />
        <button type="submit" disabled={isLoading || !domainQuery.trim()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-50">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          {isLoading ? t('seoTools.loading') : t('seoTools.lookup')}
        </button>
      </form>
      {error && <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs leading-5 text-rose-200">{error}</p>}
      {metrics.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{metric.label}</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{metric.value}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{metric.detail}</p>
            </div>
          ))}
        </div>
      )}
      {!isLoading && !error && !domainOverview && <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs leading-5 text-slate-400">{t('seoTools.noTraffic')}</p>}
      <p className="text-[11px] leading-5 text-slate-500">{t('seoTools.liveOnly')}</p>
    </div>
  );
};

interface SimulatorState {
  url: string;
  title: string;
  description: string;
}

const SerpSimulatorPanel: React.FC = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) => state.projects.find((item) => item.id === state.activeProjectId));
  const [form, setForm] = useState<SimulatorState>({ url: project?.rootUrl || '', title: '', description: '' });

  useEffect(() => {
    if (!projectId) return;
    try {
      const saved = JSON.parse(readStorage(simulatorStorageKey(projectId)) || 'null') as Partial<SimulatorState> | null;
      setForm({ url: saved?.url || project?.rootUrl || '', title: saved?.title || '', description: saved?.description || '' });
    } catch {
      setForm({ url: project?.rootUrl || '', title: '', description: '' });
    }
  }, [projectId, project?.rootUrl]);

  const update = (patch: Partial<SimulatorState>) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (projectId) writeStorage(simulatorStorageKey(projectId), JSON.stringify(next));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <div className="space-y-3">
        <label className="block text-xs text-slate-400">{t('seoTools.serpUrl')}<input value={form.url} onChange={(event) => update({ url: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white" /></label>
        <label className="block text-xs text-slate-400">{t('seoTools.serpTitle')}<input value={form.title} onChange={(event) => update({ title: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white" /></label>
        <label className="block text-xs text-slate-400">{t('seoTools.serpDescription')}<textarea value={form.description} onChange={(event) => update({ description: event.target.value })} rows={5} className="mt-1.5 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" /></label>
      </div>
      <div className="rounded-xl border border-slate-800 bg-white p-5 text-slate-900 shadow-lg">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500"><Search className="h-4 w-4" aria-hidden="true" />{t('seoTools.serpPreview')}</div>
        <p className="truncate text-sm text-emerald-700">{form.url || t('seoTools.notAvailable')}</p>
        <h3 className="mt-1 line-clamp-2 text-xl text-blue-700">{form.title || t('seoTools.serpTitle')}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-600">{form.description || t('seoTools.serpDescription')}</p>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{t('seoTools.characterCount', { count: form.title.length })} · {t('seoTools.characterCount', { count: form.description.length })}</div>
      </div>
    </div>
  );
};

export const SeoToolsWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const [activeTool, setActiveTool] = useState<SeoToolId>('competitor-analysis');

  useEffect(() => {
    if (!projectId) return;
    const stored = readStorage(tabStorageKey(projectId));
    setActiveTool(isSeoToolId(stored) ? stored : 'competitor-analysis');
  }, [projectId]);

  const selectTool = (tool: SeoToolId) => {
    setActiveTool(tool);
    if (projectId) writeStorage(tabStorageKey(projectId), tool);
  };

  const tabs = useMemo(() => toolIds.map((id) => ({ id, label: t(`seoTools.tabs.${id}`) })), [t]);
  const activeLabel = tabs.find((tab) => tab.id === activeTool)?.label || tabs[0].label;

  const content = {
    'competitor-analysis': <DomainOverview />,
    'competitor-keywords': <CompetitorKeywordsPanel />,
    'keyword-generator': <KeywordResearch />,
    'serp-simulator': <SerpSimulatorPanel />,
    'domain-age': <DomainAgePanel />,
    'spam-score': <BacklinkChecker />,
    'traffic-checker': <TrafficCheckerPanel />,
  }[activeTool];

  return (
    <section className="min-h-full bg-slate-950 pb-20">
      <PanelHeader title={t('seoTools.title')} description={t('seoTools.description')} />
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
          <div role="tablist" aria-label={t('seoTools.tabsAria')} className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTool === tab.id} onClick={() => selectTool(tab.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${activeTool === tab.id ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>{tab.label}</button>)}
          </div>
        </div>
        <div role="tabpanel" aria-label={activeLabel} className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">{t('seoTools.eyebrow')}</p><h3 className="mt-1 text-base font-semibold text-slate-100">{activeLabel}</h3></div></div>
          {content}
        </div>
      </div>
    </section>
  );
};
