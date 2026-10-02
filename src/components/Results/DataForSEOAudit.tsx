import React from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { DataForSEOAuditProps } from './dataforseoAudit/dataforseoAuditTypes';
import { DataForSeoCredentialsCard } from './dataforseoAudit/DataForSeoCredentialsCard';
import { DataForSeoTaskLogCard } from './dataforseoAudit/DataForSeoTaskLogCard';
import { DataForSeoSummaryCard } from './dataforseoAudit/DataForSeoSummaryCard';
import { DataForSeoSerpCard } from './dataforseoAudit/DataForSeoSerpCard';

export const DataForSEOAudit: React.FC<DataForSEOAuditProps> = ({ audit }) => {
  const activeProject = useProjectStore((s) => s.projects.find((project) => project.id === s.activeProjectId));

  const currentDomain = (() => {
    try {
      const target = audit?.final_url || activeProject?.rootUrl || '';
      return new URL(target).hostname;
    } catch {
      // An invalid/missing URL must remain an explicit empty state. Never
      // substitute the application's own domain for live provider evidence.
      return '';
    }
  })();

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      <DataForSeoCredentialsCard currentDomain={currentDomain} />
      <DataForSeoTaskLogCard />
      <DataForSeoSummaryCard />
      <DataForSeoSerpCard />
    </div>
  );
};
