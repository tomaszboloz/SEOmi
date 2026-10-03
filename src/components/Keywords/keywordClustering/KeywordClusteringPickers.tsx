import React from 'react';
import type { TFunction } from 'i18next';
import { resolveDataForSeoMarket } from '@/services/dataforseo';
import { DataForSeoLanguagePicker, DataForSeoLocationPicker } from '@/components/DataForSEO/DataForSeoPickers';
import { useToolsStore } from '@/stores/toolsStore';
import { type ClusteringSession, MAX_KEYWORDS } from './keywordClusteringTypes';

interface KeywordClusteringPickersProps {
  session: ClusteringSession;
  keywordsCount: number;
  isRunning: boolean;
  changeCountry: (country: string) => void;
  updateSession: (patch: Partial<ClusteringSession>) => void;
  t: TFunction;
}

export const KeywordClusteringPickers: React.FC<KeywordClusteringPickersProps> = ({
  session,
  keywordsCount,
  isRunning,
  changeCountry,
  updateSession,
  t,
}) => {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1.5 text-xs text-slate-400">
        {t('keywordClusteringUi.location')}
        <DataForSeoLocationPicker
          value={session.country}
          disabled={isRunning}
          onChange={changeCountry}
          ariaLabel={t('dataforseo.locationLabel')}
          placeholder={t('dataforseo.locationLabel')}
          className="min-w-56"
        />
      </label>
      <label className="grid gap-1.5 text-xs text-slate-400">
        {t('keywordClusteringUi.language')}
        <DataForSeoLanguagePicker
          value={session.language}
          market={resolveDataForSeoMarket(session.country) || undefined}
          disabled={isRunning}
          onChange={(language) => {
            useToolsStore.getState().setKeywordLanguage(language);
            updateSession({ language, result: null });
          }}
          ariaLabel={t('dataforseo.languageLabel')}
          placeholder={t('dataforseo.languageLabel')}
          className="min-w-48"
        />
      </label>
      <label className="grid gap-1.5 text-xs text-slate-400">
        {t('keywordClusteringUi.sharedUrls')}
        <input
          type="number"
          min={1}
          max={10}
          step={1}
          value={session.minSharedUrls}
          disabled={isRunning}
          onChange={(event) =>
            updateSession({
              minSharedUrls: Math.max(1, Math.min(10, Number.parseInt(event.target.value, 10) || 1)),
              result: null,
            })
          }
          className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
        />
      </label>
      <div className="ml-auto text-xs text-slate-500">
        {t('keywordClusteringUi.keywordLimit', { current: keywordsCount, max: MAX_KEYWORDS })}
      </div>
    </div>
  );
};
