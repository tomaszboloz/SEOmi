import React from 'react';
import { Plus } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { RankTrackingDraft } from '@/stores/tools/contracts';
import type { DataForSeoMarket } from '@/services/dataforseo';
import {
  DataForSeoLanguagePicker,
  DataForSeoLocationPicker,
} from '@/components/DataForSEO/DataForSeoPickers';
import { normalizeRankTrackingMarketDraft } from './rankTrackingTypes';

interface RankTrackingAddModalProps {
  isOpen: boolean;
  draft: RankTrackingDraft;
  selectedMarket: DataForSeoMarket | undefined;
  onUpdateDraft: (patch: Partial<RankTrackingDraft>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  t: TFunction;
}

export const RankTrackingAddModal: React.FC<RankTrackingAddModalProps> = ({
  isOpen,
  draft,
  selectedMarket,
  onUpdateDraft,
  onSubmit,
  onClose,
  t,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-400" />
          <span>{t('rankTrackingUi.trackNew')}</span>
        </h3>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              {t('rankTrackingUi.keywordQuery')}
            </label>
            <input
              type="text"
              required
              value={draft.keyword}
              onChange={(e) => onUpdateDraft({ keyword: e.target.value })}
              placeholder={t('rankTrackingUi.keywordPlaceholder')}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              {t('rankTrackingUi.domain')}
            </label>
            <input
              type="text"
              required
              value={draft.domain}
              onChange={(e) => onUpdateDraft({ domain: e.target.value })}
              placeholder={t('rankTrackingUi.domainPlaceholder')}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              {t('rankTrackingUi.targetUrlOptional')}
            </label>
            <input
              type="text"
              value={draft.targetUrl}
              onChange={(e) => onUpdateDraft({ targetUrl: e.target.value })}
              placeholder={t('rankTrackingUi.targetUrlPlaceholder')}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              {t('rankTrackingUi.country')}
            </label>
            <DataForSeoLocationPicker
              value={draft.location}
              onChange={(location) =>
                onUpdateDraft(normalizeRankTrackingMarketDraft(location, draft.language))
              }
              ariaLabel={t('dataforseo.locationLabel')}
              placeholder={t('dataforseo.locationLabel')}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              {t('rankTrackingUi.language')}
            </label>
            <DataForSeoLanguagePicker
              value={draft.language}
              market={selectedMarket}
              onChange={(language) => onUpdateDraft({ language })}
              ariaLabel={t('dataforseo.languageLabel')}
              placeholder={t('dataforseo.languageLabel')}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              {t('rankTrackingUi.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
            >
              {t('rankTrackingUi.startTracking')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
