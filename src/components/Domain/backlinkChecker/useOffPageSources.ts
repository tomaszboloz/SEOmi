import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BacklinkProfileData } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { prePublishContext } from '@/services/prePublish/context';
import { analyzeSources } from '@/services/offPage/analyzeSources';
import type { SourceAnalysis, SourceEvidence } from '@/services/offPage/sources';
import type { SourceEmbeddingSettings } from '@/services/offPage/sourceEmbeddings';
import { loadEmbeddingSession } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';

type Status = 'idle' | 'running' | 'done' | 'cancelled' | 'unavailable';
interface State { status: Status; sources: SourceEvidence[]; analysis: SourceAnalysis | null }
const idle: State = { status: 'idle', sources: [], analysis: null };

export const useOffPageSources = (profile: BacklinkProfileData) => {
  const project = useProjectStore((store) => store.projects.find((entry) => entry.id === store.activeProjectId));
  const runs = useToolsStore((store) => store.crawlRuns);
  const context = useMemo(() => prePublishContext(project?.id ?? null, runs), [project?.id, runs]);
  const owner = useMemo(() => ({ profile, project, context }), [profile, project, context]);
  const activeOwner = useRef<typeof owner | null>(null);
  const revision = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<State>(idle);
  const [settings, updateSettings] = useState<SourceEmbeddingSettings>({ provider: 'local' });
  useLayoutEffect(() => {
    activeOwner.current = owner;
    setState(idle);
    const saved = loadEmbeddingSession(project?.id ?? null).settings;
    updateSettings({ provider: saved.provider === 'ollama' ? 'ollama' : 'local', ollamaModel: saved.ollamaModel });
    return () => {
      activeOwner.current = null;
      revision.current += 1;
      controller.current?.abort();
    };
  }, [owner, project?.id]);
  const cancel = () => {
    revision.current += 1;
    controller.current?.abort();
    setState((previous) => ({ ...previous, status: 'cancelled', analysis: null }));
  };
  const run = async () => {
    if (!project || activeOwner.current !== owner) return;
    controller.current?.abort();
    const request = ++revision.current;
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'running', sources: [], analysis: null });
    try {
      const analysis = await analyzeSources(profile, project.name, context.coreText,
        context.coreText ? context.focus!.coreTopic.label : '', settings, abort.signal, (sources) => {
          if (request === revision.current) setState({ status: 'running', sources, analysis: null });
        }, project.rootUrl);
      if (request === revision.current) setState({ status: 'done', sources: analysis.sources, analysis });
    } catch {
      if (request === revision.current) setState((previous) => ({ ...previous, status: 'unavailable', analysis: null }));
    }
  };
  const setSettings = (next: SourceEmbeddingSettings) => {
    revision.current += 1;
    controller.current?.abort();
    setState(idle);
    updateSettings(next);
  };
  return { ...state, settings, setSettings, run, cancel, enabled: !!project };
};
