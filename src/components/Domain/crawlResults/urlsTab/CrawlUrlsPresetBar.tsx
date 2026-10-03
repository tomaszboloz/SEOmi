import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawlFilterPreset } from '../crawlResultsHelpers';

interface CrawlUrlsPresetBarProps {
  activeProjectId: string | null;
  filterPresets: CrawlFilterPreset[];
  selectedPresetId: string;
  applyFilterPreset: (presetId: string) => void;
  newPresetName: string;
  setNewPresetName: (name: string) => void;
  saveFilterPreset: () => void;
  persistFilterPresets: (presets: CrawlFilterPreset[]) => void;
  setSelectedPresetId: (id: string) => void;
  t: TFunction;
}

export const CrawlUrlsPresetBar: React.FC<CrawlUrlsPresetBarProps> = ({
  activeProjectId,
  filterPresets,
  selectedPresetId,
  applyFilterPreset,
  newPresetName,
  setNewPresetName,
  saveFilterPreset,
  persistFilterPresets,
  setSelectedPresetId,
  t,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
      <label className="text-xs text-slate-400">
        {t('crawl.ui.projectFilters')}
        <select
          aria-label={t('crawl.ui.savedProjectFilters')}
          value={selectedPresetId}
          onChange={(event) => applyFilterPreset(event.target.value)}
          className="ml-2 h-8 max-w-56 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
        >
          <option value="">{t('crawl.ui.notSaved')}</option>
          {filterPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <input
        aria-label={t('crawl.ui.savedFilterName')}
        value={newPresetName}
        onChange={(event) => setNewPresetName(event.target.value)}
        maxLength={60}
        placeholder={t('crawl.ui.newFilterName')}
        className="h-8 min-w-40 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
      />
      <button
        type="button"
        disabled={!activeProjectId || !newPresetName.trim()}
        onClick={saveFilterPreset}
        className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white disabled:opacity-40"
      >
        {t('crawl.ui.saveFilter')}
      </button>
      {selectedPresetId && (
        <button
          type="button"
          onClick={() => {
            persistFilterPresets(
              filterPresets.filter((preset) => preset.id !== selectedPresetId),
            );
            setSelectedPresetId('');
          }}
          className="h-8 rounded-md border border-slate-700 px-2.5 text-xs text-slate-300"
        >
          {t('crawl.ui.removeFilter')}
        </button>
      )}
      {!activeProjectId && (
        <span className="text-[11px] text-amber-300">
          {t('crawl.ui.chooseProjectForFilters')}
        </span>
      )}
    </div>
  );
};
