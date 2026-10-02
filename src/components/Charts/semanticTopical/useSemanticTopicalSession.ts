import { assessContentBrief } from '@/services/contentBrief';
import type { Props } from './contracts';
import {
  type TopicalSessionDependencies,
  defaultSessionDependencies,
} from './session/topicalSessionTypes';
import { useTopicalLabels } from './session/useTopicalLabels';
import { useTopicalDocumentState } from './session/useTopicalDocumentState';
import { useTopicalUrlCandidates } from './session/useTopicalUrlCandidates';
import { useTopicalNodeMutations } from './session/useTopicalNodeMutations';
import { useTopicalFacts } from './session/useTopicalFacts';
import { useTopicalImports } from './session/useTopicalImports';

export type { TopicalSessionDependencies };

export const useSemanticTopicalSession = (
  {
    projectId,
    pages,
    graph,
    runId,
    sitemapUrls = [],
    runs = [],
    currentRunId = runId,
  }: Props,
  dependencies: TopicalSessionDependencies = defaultSessionDependencies,
) => {
  const { t, intentLabels, lifecycleLabels, nodeKindLabels, sourceMetric } = useTopicalLabels();

  const {
    document,
    documentRef,
    selectedId,
    setSelectedId,
    workspacePreferences,
    saveError,
    preferencesSaveError,
    persist,
    updateWorkspacePreferences,
  } = useTopicalDocumentState({ projectId, dependencies });

  const selectedNode =
    document.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedFacts = selectedNode
    ? [...document.entity.facts, ...selectedNode.facts]
    : [];
  const selectedBriefAssessment = selectedNode
    ? assessContentBrief(selectedNode, selectedNode.contentBrief, selectedFacts, pages)
    : null;

  const urlCandidates = useTopicalUrlCandidates({
    pages,
    sitemapUrls,
    document,
    selectedNode,
    workspacePreferences,
  });

  const nodeMutations = useTopicalNodeMutations({
    documentRef,
    pages,
    t,
    persist,
    setSelectedId,
    updateWorkspacePreferences,
  });

  const facts = useTopicalFacts({
    documentRef,
    selectedNode,
    updateEntity: nodeMutations.updateEntity,
    updateNode: nodeMutations.updateNode,
  });

  const imports = useTopicalImports({
    documentRef,
    selectedNode,
    graph,
    pages,
    runId,
    persist,
    setSelectedId,
    updateNode: nodeMutations.updateNode,
    t,
  });

  return {
    ...facts,
    ...nodeMutations,
    ...urlCandidates,
    ...imports,
    currentRunId,
    document,
    documentRef,
    graph,
    intentLabels,
    lifecycleLabels,
    nodeKindLabels,
    pages,
    persist,
    preferencesSaveError,
    runId,
    runs,
    saveError,
    selectedBriefAssessment,
    selectedFacts,
    selectedId,
    selectedNode,
    setSelectedId,
    sourceMetric,
    t,
    updateWorkspacePreferences,
    workspacePreferences,
  };
};
