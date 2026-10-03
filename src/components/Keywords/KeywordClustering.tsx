import React from 'react';
import { useTranslation } from 'react-i18next';
import { useKeywordClusteringSession } from './keywordClustering/useKeywordClusteringSession';
import { KeywordClusteringHeader } from './keywordClustering/KeywordClusteringHeader';
import { KeywordClusteringForm } from './keywordClustering/KeywordClusteringForm';
import { KeywordClusteringResults } from './keywordClustering/KeywordClusteringResults';

export const KeywordClustering: React.FC = () => {
  const { t } = useTranslation();
  const {
    session,
    keywords,
    credentials,
    currentResearch,
    savedKeywords,
    isRunning,
    progress,
    error,
    updateSession,
    appendKeywords,
    changeCountry,
    runClustering,
  } = useKeywordClusteringSession(t);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <KeywordClusteringHeader t={t} />

      <KeywordClusteringForm
        session={session}
        keywords={keywords}
        credentials={credentials}
        currentResearch={currentResearch}
        savedKeywords={savedKeywords}
        isRunning={isRunning}
        progress={progress}
        error={error}
        updateSession={updateSession}
        appendKeywords={appendKeywords}
        changeCountry={changeCountry}
        runClustering={runClustering}
        t={t}
      />

      {session.result && <KeywordClusteringResults result={session.result} t={t} />}
    </div>
  );
};
