import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuditStore } from '@/stores/auditStore';
import { getMetadataProblems } from '@/services/auditProblems';
import { ProblemsOnlyNotice } from './ProblemsOnlyNotice';
import { MetadataTableProps } from './metadata/metadataTypes';
import { MetadataSpotlight } from './metadata/MetadataSpotlight';
import { MetadataDirectives } from './metadata/MetadataDirectives';
import { MetadataTechnologies } from './metadata/MetadataTechnologies';
import { MetadataAccessibility } from './metadata/MetadataAccessibility';
import { MetadataFavicons } from './metadata/MetadataFavicons';
import { MetadataHreflang } from './metadata/MetadataHreflang';
import { MetadataOtherTags } from './metadata/MetadataOtherTags';

export type { MetadataTableProps };

export const MetadataTable: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();
  const showOnlyProblems = useAuditStore((state) => state.showOnlyProblems);
  const metadataProblems = getMetadataProblems(audit);

  if (showOnlyProblems) {
    return (
      <div className="mx-auto max-w-5xl animate-in fade-in duration-200 p-4 md:p-6">
        <ProblemsOnlyNotice problems={metadataProblems} subject={t('sidebar.metadata')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      <MetadataSpotlight audit={audit} />
      <MetadataDirectives audit={audit} />
      <MetadataTechnologies audit={audit} />
      <MetadataAccessibility audit={audit} />
      <MetadataFavicons audit={audit} />
      <MetadataHreflang audit={audit} />
      <MetadataOtherTags audit={audit} />
    </div>
  );
};
