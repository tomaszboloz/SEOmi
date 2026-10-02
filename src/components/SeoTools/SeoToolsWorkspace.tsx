import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BacklinkChecker } from '@/components/Domain/BacklinkChecker';
import { DomainOverview } from '@/components/Domain/DomainOverview';
import { KeywordResearch } from '@/components/Keywords/KeywordResearch';
import { useProjectStore } from '@/stores/projectStore';
import { readStorage, writeStorage } from '@/services/storage';
import {
  type SeoToolId,
  toolIds,
  tabStorageKey,
  isSeoToolId,
} from './workspace/seoToolsTypes';
import { SeoToolsPanelHeader } from './workspace/SeoToolsPanelHeader';
import { DomainAgePanel } from './workspace/DomainAgePanel';
import { CompetitorKeywordsPanel } from './workspace/CompetitorKeywordsPanel';
import { TrafficCheckerPanel } from './workspace/TrafficCheckerPanel';
import { SerpSimulatorPanel } from './workspace/SerpSimulatorPanel';

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

  const tabs = useMemo(
    () => toolIds.map((id) => ({ id, label: t(`seoTools.tabs.${id}`) })),
    [t],
  );
  const activeLabel =
    tabs.find((tab) => tab.id === activeTool)?.label || tabs[0].label;

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
      <SeoToolsPanelHeader
        title={t('seoTools.title')}
        description={t('seoTools.description')}
      />
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
          <div
            role="tablist"
            aria-label={t('seoTools.tabsAria')}
            className="flex gap-1 overflow-x-auto pb-1"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTool === tab.id}
                onClick={() => selectTool(tab.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  activeTool === tab.id
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div
          role="tabpanel"
          aria-label={activeLabel}
          className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                {t('seoTools.eyebrow')}
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-100">
                {activeLabel}
              </h3>
            </div>
          </div>
          {content}
        </div>
      </div>
    </section>
  );
};
