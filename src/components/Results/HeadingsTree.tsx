import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageAuditData } from '@/types';
import { flattenHeadings } from '@/services/keyphraseAnalysis';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { readStorage } from '@/services/storage';
import { HeadingsSummaryCards } from './headingsTree/HeadingsSummaryCards';
import { HeadingsIssuesCallout } from './headingsTree/HeadingsIssuesCallout';
import { HeadingsKeyphraseSection } from './headingsTree/HeadingsKeyphraseSection';
import { HeadingsTreeView } from './headingsTree/HeadingsTreeView';
import { keyphraseStorageKey } from './headingsTree/headingsTreeTypes';

interface HeadingsTreeProps {
  audit: PageAuditData;
}

export const HeadingsTree: React.FC<HeadingsTreeProps> = ({ audit }) => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [keyphrase, setKeyphrase] = useState('');
  const showOnlyProblems = useAuditStore((state) => state.showOnlyProblems);
  const auditTarget = audit.final_url || audit.url;
  const savedKeyphraseKey = activeProjectId && auditTarget
    ? keyphraseStorageKey(activeProjectId, auditTarget)
    : null;

  useEffect(() => {
    setKeyphrase(savedKeyphraseKey ? readStorage(savedKeyphraseKey) || '' : '');
  }, [savedKeyphraseKey]);

  const { headings } = audit;
  const flatHeadings = flattenHeadings(headings.hierarchy);

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      <HeadingsSummaryCards
        headings={headings}
        totalHeadings={flatHeadings.length}
      />

      <HeadingsIssuesCallout issues={headings.issues} />

      {!showOnlyProblems && (
        <HeadingsKeyphraseSection
          audit={audit}
          keyphrase={keyphrase}
          setKeyphrase={setKeyphrase}
          savedKeyphraseKey={savedKeyphraseKey}
        />
      )}

      {!showOnlyProblems && (
        <HeadingsTreeView
          flatHeadings={flatHeadings}
          auditUrl={auditTarget}
        />
      )}

      {showOnlyProblems && headings.issues.length === 0 && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center text-sm text-emerald-200">
          {t('legacyUi.headings.noProblems')}
        </div>
      )}
    </div>
  );
};
