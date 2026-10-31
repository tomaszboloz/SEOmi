import { useEffect, useState } from 'react';
import { loadEmbeddingSession } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';
import { monitorIgosDrop } from '@/services/igos/alert';
import { recordIgosRun, type IgosHistoryEntry } from '@/services/igos/history';
import { buildPhraseIgosWithSettings } from '@/services/igos/phraseIgosProvider';
import type { IgosReport } from '@/services/igos/report';
import type { TopTenCorpus } from '@/services/targetPhraseAudit/types';

export interface PhraseIgosContext { projectId: string | null; phrase: string; language?: string | null }
export interface PhraseIgosState { report: IgosReport | null; history: IgosHistoryEntry[] }

const EMPTY: PhraseIgosState = { report: null, history: [] };

/**
 * IGOS for the audited phrase; stays empty until a TOP 10 corpus with target text exists. Uses the
 * project's embedding settings (#86) and stores each run in the project's phrase history (GEM-68-06).
 */
export const usePhraseIgos = (corpus: TopTenCorpus | undefined, context: PhraseIgosContext = { projectId: null, phrase: '' }): PhraseIgosState => {
  const [state, setState] = useState<PhraseIgosState>(EMPTY);
  const { projectId, phrase, language } = context;
  useEffect(() => {
    let current = true;
    setState(EMPTY);
    if (corpus) {
      void buildPhraseIgosWithSettings(corpus, loadEmbeddingSession(projectId).settings, { language: language ?? undefined })
        .then((report) => { const history = report ? recordIgosRun(projectId, phrase, report) : [];
          if (current) setState({ report, history });
          void monitorIgosDrop(projectId, phrase, history).catch(() => undefined); })
        .catch(() => { if (current) setState(EMPTY); });
    }
    return () => { current = false; };
  }, [corpus, projectId, phrase, language]);
  return state;
};
