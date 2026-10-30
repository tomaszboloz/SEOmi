import { useEffect, useState } from 'react';
import { buildPhraseIgos } from '@/services/igos/phraseIgos';
import type { IgosReport } from '@/services/igos/report';
import type { TopTenCorpus } from '@/services/targetPhraseAudit/types';

/** IGOS for the audited phrase; stays null until a TOP 10 corpus with target text exists. */
export const usePhraseIgos = (corpus: TopTenCorpus | undefined): IgosReport | null => {
  const [report, setReport] = useState<IgosReport | null>(null);
  useEffect(() => {
    let current = true;
    setReport(null);
    if (corpus) {
      void buildPhraseIgos(corpus)
        .then((next) => { if (current) setReport(next); })
        .catch(() => { if (current) setReport(null); });
    }
    return () => { current = false; };
  }, [corpus]);
  return report;
};
