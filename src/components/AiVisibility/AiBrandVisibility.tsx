import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAiBrandVisibilitySession } from './brandVisibility/useAiBrandVisibilitySession';
import { AiBrandHeader } from './brandVisibility/AiBrandHeader';
import { AiBrandInputForm } from './brandVisibility/AiBrandInputForm';
import { AiBrandOverviewCards } from './brandVisibility/AiBrandOverviewCards';
import { AiBrandModelsGrid } from './brandVisibility/AiBrandModelsGrid';

export const AiBrandVisibility: React.FC = () => {
  const { t } = useTranslation();
  const {
    aiBrandQuery,
    setAiBrandQuery,
    aiBrandDomain,
    setAiBrandDomain,
    aiBrandReport,
    aiBrandHistory,
    isLoading,
    error,
    selectAiBrandReport,
    researchSettings,
    setResearchSettings,
    prompts,
    setPrompts,
    competitors,
    setCompetitors,
    connectedProviders,
    handleQuery,
  } = useAiBrandVisibilitySession();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <AiBrandHeader connectedProvidersCount={connectedProviders.length} t={t} />

      <AiBrandInputForm
        brand={aiBrandQuery}
        domain={aiBrandDomain}
        prompts={prompts}
        competitors={competitors}
        researchSettings={researchSettings}
        isLoading={isLoading}
        onChangeBrand={setAiBrandQuery}
        onChangeDomain={setAiBrandDomain}
        onChangePrompts={setPrompts}
        onChangeCompetitors={setCompetitors}
        onUpdateResearchSettings={setResearchSettings}
        onSubmit={handleQuery}
        t={t}
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {aiBrandReport && (
        <div className="space-y-8">
          <AiBrandOverviewCards report={aiBrandReport} t={t} />

          <AiBrandModelsGrid
            report={aiBrandReport}
            history={aiBrandHistory}
            onSelectReport={selectAiBrandReport}
            t={t}
          />
        </div>
      )}
    </div>
  );
};
