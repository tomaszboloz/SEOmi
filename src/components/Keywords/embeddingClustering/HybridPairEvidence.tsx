import { useTranslation } from 'react-i18next';
import type { EmbeddingClusteringResult } from '@/services/embeddingClustering';

export const HybridPairEvidence = ({ pairs }: { pairs: NonNullable<EmbeddingClusteringResult['pairEvidence']> }) => {
  const { t } = useTranslation();
  return <details className="rounded-xl border border-slate-800 p-4 text-xs text-slate-300">
    <summary>{t('serpImportUi.pairs', { count: pairs.length })}</summary>
    <p className="my-2">{t('serpImportUi.pairHelp')}</p>
    <ul className="space-y-2">{pairs.slice(0, 100).map((pair, index) => <li key={index} className="rounded bg-slate-900 p-2">
      <p>{pair.keywordA} ↔ {pair.keywordB} · {pair.mode}</p>
      <p>{t('serpImportUi.scores', { semantic: pair.semanticCosine.toFixed(3), serp: pair.serpJaccard === null ? t('serpImportUi.unknown') : pair.serpJaccard.toFixed(3), score: pair.score.toFixed(3) })}</p>
      <p>{t('serpImportUi.weights', { semantic: pair.appliedWeights.semantic, serp: pair.appliedWeights.serp })}</p>
      <p>{pair.reasons.join(', ')}</p>
      {pair.sharedUrls.length > 0 && <p>{pair.sharedUrls.join(' · ')}</p>}
      <p>{t('serpImportUi.pairSources', { a: pair.sourceA?.provider ?? t('serpImportUi.unknown'), b: pair.sourceB?.provider ?? t('serpImportUi.unknown') })}</p>
    </li>)}</ul>
    {pairs.length > 100 && <p>{t('serpImportUi.visiblePairs', { count: 100 })}</p>}
  </details>;
};
