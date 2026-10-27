

import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { CrawlerReadinessPanel } from "@/components/Results/CrawlerReadinessPanel";
import { latestLogCrawl } from './logIntelligence/matrixView';
import { lazyRoute } from '@/services/lazyRoute';

import type { useCrawlResultsSession } from './useCrawlResultsSession';
type Session = ReturnType<typeof useCrawlResultsSession>;
const LogIntelligencePanel = lazyRoute(() => import('./logIntelligence/LogIntelligencePanel'));

export const CrawlCrawlerReadinessTab = ({ session }: { session: Session }) => {
  const { result, activeProjectId, runs } = session;
  const { t: translate } = useTranslation();
  return <div className="space-y-4">
    <CrawlerReadinessPanel result={result} />
    {activeProjectId && <Suspense fallback={<p role="status">{translate('logIntelUi.loading')}</p>}>
      <LogIntelligencePanel key={activeProjectId} projectId={activeProjectId} run={latestLogCrawl(runs, activeProjectId)} />
    </Suspense>}
  </div>;
};
