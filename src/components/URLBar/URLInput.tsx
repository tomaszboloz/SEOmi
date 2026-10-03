import React, { useEffect, useState } from 'react';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { readStorage, writeStorage } from '@/services/storage';
import { auditUrlDraftKey } from './urlInput/urlInputTypes';
import { URLInputField } from './urlInput/URLInputField';
import { URLInputActions } from './urlInput/URLInputActions';
import { URLBatchQueueSection } from './urlInput/URLBatchQueueSection';

export const URLInput: React.FC = () => {
  const [url, setUrl] = useState('');
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const projectRootUrl = useProjectStore(
    (state) => state.projects.find((project) => project.id === state.activeProjectId)?.rootUrl || '',
  );
  const startAudit = useAuditStore((s) => s.startAudit);
  const isLoading = useAuditStore((s) => s.isLoading);
  const currentAudit = useAuditStore((s) => s.currentAudit);

  useEffect(() => {
    if (!activeProjectId) {
      setUrl('');
      return;
    }
    const savedDraft = readStorage(auditUrlDraftKey(activeProjectId));
    setUrl(savedDraft !== null ? savedDraft : projectRootUrl);
  }, [activeProjectId, projectRootUrl]);

  const updateUrl = (value: string) => {
    setUrl(value);
    if (activeProjectId) writeStorage(auditUrlDraftKey(activeProjectId), value.slice(0, 2048));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    startAudit(url.trim());
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        updateUrl(text.trim());
      }
    } catch {
      // Clipboard read permission declined
    }
  };

  const handleReAudit = () => {
    if (currentAudit?.url) {
      startAudit(currentAudit.url);
    }
  };

  return (
    <div className="bg-slate-950/60 border-b border-slate-800/80 px-4 py-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-6xl mx-auto">
        <URLInputField
          url={url}
          onChange={updateUrl}
          onPaste={handlePaste}
          isLoading={isLoading}
        />
        <URLInputActions
          url={url}
          isLoading={isLoading}
          onReAudit={handleReAudit}
          hasCurrentAudit={Boolean(currentAudit)}
        />
      </form>
      <URLBatchQueueSection />
    </div>
  );
};
