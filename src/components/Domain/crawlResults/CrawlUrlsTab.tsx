import React from 'react';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { CrawlPageTable } from './CrawlPageTable';
import { CrawlUrlsSearchSortBar } from './urlsTab/CrawlUrlsSearchSortBar';
import { CrawlUrlsFilterBar } from './urlsTab/CrawlUrlsFilterBar';
import { CrawlUrlsPresetBar } from './urlsTab/CrawlUrlsPresetBar';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlUrlsTab: React.FC<{ session: Session }> = ({ session }) => {
  const {
    activeErrorKind,
    activeProjectId,
    applyFilterPreset,
    descending,
    errorKinds,
    filterPresets,
    newPresetName,
    onlyProblems,
    pages,
    persistFilterPresets,
    query,
    result,
    saveFilterPreset,
    segment,
    selectedPresetId,
    setDescending,
    setErrorKind,
    setNewPresetName,
    setOnlyProblems,
    setQuery,
    setSegment,
    setSelectedPresetId,
    setSeverity,
    setSort,
    severity,
    sort,
    t,
  } = session;

  return (
    <div className="space-y-3">
      <CrawlUrlsSearchSortBar
        query={query}
        setQuery={setQuery}
        segment={segment}
        setSegment={setSegment}
        sort={sort}
        setSort={setSort}
        descending={descending}
        setDescending={setDescending}
        t={t}
      />
      <CrawlUrlsFilterBar
        onlyProblems={onlyProblems}
        setOnlyProblems={setOnlyProblems}
        severity={severity}
        setSeverity={setSeverity}
        activeErrorKind={activeErrorKind}
        setErrorKind={setErrorKind}
        errorKinds={errorKinds}
        filteredCount={pages.length}
        totalCount={result.pages.length}
        t={t}
      />
      <CrawlUrlsPresetBar
        activeProjectId={activeProjectId}
        filterPresets={filterPresets}
        selectedPresetId={selectedPresetId}
        applyFilterPreset={applyFilterPreset}
        newPresetName={newPresetName}
        setNewPresetName={setNewPresetName}
        saveFilterPreset={saveFilterPreset}
        persistFilterPresets={persistFilterPresets}
        setSelectedPresetId={setSelectedPresetId}
        t={t}
      />
      <CrawlPageTable session={session} rows={pages} />
    </div>
  );
};
