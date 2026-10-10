import React from 'react';
import { useKeywordResearchSession } from './keywordResearch/useKeywordResearchSession';
import { KeywordResearchHeader } from './keywordResearch/KeywordResearchHeader';
import { KeywordResearchSearchForm } from './keywordResearch/KeywordResearchSearchForm';
import { KeywordPrimaryCard } from './keywordResearch/KeywordPrimaryCard';
import { KeywordIdeasTable } from './keywordResearch/KeywordIdeasTable';
import { DataForSeoCostMeter } from '@/components/DataForSEO/cost/DataForSeoCostMeter';
import { TrendingNowPanel } from '@/components/KeywordResearch/TrendingNowPanel';
import { FreeSuggestionsPanel } from '@/components/KeywordResearch/freeSuggestions/FreeSuggestionsPanel';

export const KeywordResearch: React.FC = () => {
  const {
    t,
    inputQuery,
    setInputQuery,
    selectedCountry,
    setSelectedCountry,
    selectedLanguage,
    setSelectedLanguage,
    intentFilter,
    setIntentFilter,
    savedIds,
    handleSearch,
    handleSave,
    filteredResults,
    primaryItem,
    savedKeywords,
    isLoading,
    error,
  } = useKeywordResearchSession();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <KeywordResearchHeader t={t} />
      <DataForSeoCostMeter />
      <TrendingNowPanel />

      <KeywordResearchSearchForm
        inputQuery={inputQuery}
        setInputQuery={setInputQuery}
        selectedCountry={selectedCountry}
        setSelectedCountry={setSelectedCountry}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        isLoading={isLoading}
        error={error}
        handleSearch={handleSearch}
        t={t}
      />

      <FreeSuggestionsPanel query={inputQuery} geo={selectedCountry} language={selectedLanguage} />

      {primaryItem && (
        <KeywordPrimaryCard
          primaryItem={primaryItem}
          isSaved={
            savedIds[primaryItem.keyword] ||
            savedKeywords.some((k) => k.keyword === primaryItem.keyword)
          }
          onSave={handleSave}
          t={t}
        />
      )}

      <KeywordIdeasTable
        filteredResults={filteredResults}
        intentFilter={intentFilter}
        setIntentFilter={setIntentFilter}
        savedIds={savedIds}
        savedKeywords={savedKeywords}
        onSave={handleSave}
        t={t}
      />
    </div>
  );
};
