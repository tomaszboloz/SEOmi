import { useTranslation } from 'react-i18next';
import type { SearchIntent, TopicalNode } from '@/services/topicalMap';
import { appLocale } from '@/services/localeFormat';

export const useTopicalLabels = () => {
  const { t } = useTranslation();

  const intentLabels: Record<SearchIntent, string> = {
    informational: t('semanticWorkspace.intent.informational'),
    commercial: t('semanticWorkspace.intent.commercial'),
    transactional: t('semanticWorkspace.intent.transactional'),
    navigational: t('semanticWorkspace.intent.navigational'),
    mixed: t('semanticWorkspace.intent.mixed'),
    unknown: t('semanticWorkspace.intent.unknown'),
  };

  const lifecycleLabels: Record<TopicalNode['lifecycle'], string> = {
    planned: t('semanticWorkspace.lifecycle.planned'),
    briefed: t('semanticWorkspace.lifecycle.briefed'),
    drafted: t('semanticWorkspace.lifecycle.drafted'),
    published: t('semanticWorkspace.lifecycle.published'),
    'needs-update': t('semanticWorkspace.lifecycle.needsUpdate'),
  };

  const nodeKindLabels: Record<TopicalNode['kind'], string> = {
    pillar: t('semanticWorkspace.kind.pillar'),
    cluster: t('semanticWorkspace.kind.cluster'),
    supporting: t('semanticWorkspace.kind.supporting'),
  };

  const sourceMetric = (value: number | null) =>
    value === null
      ? t('semanticWorkspace.sourceMetricMissing')
      : value.toLocaleString(appLocale());

  return { t, intentLabels, lifecycleLabels, nodeKindLabels, sourceMetric };
};
