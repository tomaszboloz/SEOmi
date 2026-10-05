import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { writeStorage } from '@/services/storage';
import { useKeywordClusteringSession } from './keywordClustering/useKeywordClusteringSession';
import { KeywordClusteringHeader } from './keywordClustering/KeywordClusteringHeader';
import { KeywordClusteringForm } from './keywordClustering/KeywordClusteringForm';
import { KeywordClusteringResults } from './keywordClustering/KeywordClusteringResults';
import { KeywordInput } from './keywordClustering/KeywordInput';
import { loadSession } from './keywordClustering/keywordClusteringStorage';
import { DataForSeoCostMeter } from '@/components/DataForSEO/cost/DataForSeoCostMeter';
import { EmbeddingClusteringPanel } from './embeddingClustering/EmbeddingClusteringPanel';
import { ClusteringMethodSwitch, loadMethod, methodKey, type ClusteringMethod } from './embeddingClustering/ClusteringMethodSwitch';

const hasSerpResult = (projectId: string): boolean => Boolean(loadSession(projectId).result);

export const KeywordClustering: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [method, setMethod] = useState<ClusteringMethod>(() => loadMethod(activeProjectId, hasSerpResult));
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

  useEffect(() => setMethod(loadMethod(activeProjectId, hasSerpResult)), [activeProjectId]);

  const changeMethod = (value: ClusteringMethod) => {
    setMethod(value);
    if (activeProjectId) writeStorage(methodKey(activeProjectId), value);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <KeywordClusteringHeader t={t} />
      <ClusteringMethodSwitch method={method} disabled={isRunning} onChange={changeMethod} />

      {method === 'serp' ? (
        <>
          <DataForSeoCostMeter />
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
        </>
      ) : (
        <>
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            {/* Editing phrases for free embeddings must not discard a paid SERP result. */}
            <KeywordInput session={session} isRunning={false} currentResearch={currentResearch} savedKeywords={savedKeywords} updateSession={(patch) => updateSession({ ...patch, result: session.result })} appendKeywords={appendKeywords} t={t} />
          </section>
          <EmbeddingClusteringPanel projectId={activeProjectId} keywords={keywords} />
        </>
      )}
    </div>
  );
};
