import React from 'react';
import { useSavedKeywordsSession } from './savedKeywords/useSavedKeywordsSession';
import { SavedKeywordsHeader } from './savedKeywords/SavedKeywordsHeader';
import { SavedKeywordsMetricsCards } from './savedKeywords/SavedKeywordsMetricsCards';
import { SavedKeywordsFilterBar } from './savedKeywords/SavedKeywordsFilterBar';
import { SavedKeywordsTable } from './savedKeywords/SavedKeywordsTable';

export const SavedKeywords: React.FC = () => {
  const {
    t,
    savedKeywords,
    searchFilter,
    setSearchFilter,
    activeTagFilter,
    setActiveTagFilter,
    newTagInput,
    setNewTagInput,
    allTags,
    totalKeywords,
    totalVolume,
    avgDifficulty,
    estMonthlyValue,
    filteredList,
    exportCSV,
    handleAddTag,
    handleRemoveTag,
    removeSavedKeyword,
    setActiveTab,
  } = useSavedKeywordsSession();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <SavedKeywordsHeader
        hasSavedKeywords={savedKeywords.length > 0}
        onFindMore={() => setActiveTab('keyword-research')}
        onExportCsv={exportCSV}
        t={t}
      />

      <SavedKeywordsMetricsCards
        totalKeywords={totalKeywords}
        totalVolume={totalVolume}
        avgDifficulty={avgDifficulty}
        estMonthlyValue={estMonthlyValue}
        t={t}
      />

      <SavedKeywordsFilterBar
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        activeTagFilter={activeTagFilter}
        setActiveTagFilter={setActiveTagFilter}
        allTags={allTags}
        totalSavedKeywords={savedKeywords.length}
        t={t}
      />

      <SavedKeywordsTable
        filteredList={filteredList}
        newTagInput={newTagInput}
        setNewTagInput={setNewTagInput}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onDeleteKeyword={removeSavedKeyword}
        onExploreNow={() => setActiveTab('keyword-research')}
        t={t}
      />
    </div>
  );
};
