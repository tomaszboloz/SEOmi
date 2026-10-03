import { useState, type MutableRefObject } from 'react';
import type { TFunction } from 'i18next';
import {
  createTopicalNode,
  setTopicalNodeParent,
  type TopicalMapDocument,
  type TopicalNode,
} from '@/services/topicalMap';
import { assessContentBrief } from '@/services/contentBrief';
import type { CrawledPageSummary } from '@/types';
import type { TopicalWorkspacePreferences } from '../workspaceHelpers';

interface Props {
  documentRef: MutableRefObject<TopicalMapDocument>;
  pages: CrawledPageSummary[];
  t: TFunction;
  persist: (next: TopicalMapDocument) => void;
  setSelectedId: (id: string | null) => void;
  updateWorkspacePreferences: (patch: Partial<TopicalWorkspacePreferences>) => void;
}

export const useTopicalNodeMutations = ({
  documentRef,
  pages,
  t,
  persist,
  setSelectedId,
  updateWorkspacePreferences,
}: Props) => {
  const [hierarchyNotice, setHierarchyNotice] = useState('');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  const moveTopicalNode = (nodeId: string, parentId: string | null) => {
    const current = documentRef.current;
    const node = current.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.parentId === parentId) return;
    const next = setTopicalNodeParent(current, nodeId, parentId);
    if (next === current) {
      setHierarchyNotice(t('semanticWorkspace.cannotCreateCycle'));
      return;
    }
    persist(next);
    const parentTitle = parentId
      ? current.nodes.find((candidate) => candidate.id === parentId)?.title
      : null;
    setHierarchyNotice(
      parentTitle
        ? t('semanticWorkspace.assignedToParent', {
            node: node.title,
            parent: parentTitle,
          })
        : t('semanticWorkspace.assignedToRoot', { node: node.title }),
    );
  };

  const dropTopicOn =
    (parentId: string | null) => (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const nodeId = event.dataTransfer.getData('text/plain') || draggingNodeId;
      if (nodeId) moveTopicalNode(nodeId, parentId);
      setDraggingNodeId(null);
    };

  const addNode = () => {
    const node = createTopicalNode();
    persist({
      ...documentRef.current,
      nodes: [...documentRef.current.nodes, node],
    });
    setSelectedId(node.id);
  };

  const addNodeOnDate = (date: string) => {
    const node = { ...createTopicalNode(), scheduledDate: date };
    persist({
      ...documentRef.current,
      nodes: [...documentRef.current.nodes, node],
    });
    setSelectedId(node.id);
    updateWorkspacePreferences({ view: 'topics' });
  };

  const updateNode = (nodeId: string, update: Partial<TopicalNode>) => {
    const nextDocument = {
      ...documentRef.current,
      nodes: documentRef.current.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const next = { ...node, ...update };
        const assessment = assessContentBrief(
          next,
          next.contentBrief,
          [...documentRef.current.entity.facts, ...next.facts],
          pages,
        );
        if (next.lifecycle === 'drafted' && !assessment.readyToAdvance)
          next.lifecycle = 'briefed';
        if (next.lifecycle === 'briefed' && !assessment.readyForBrief)
          next.lifecycle = 'planned';
        return next;
      }),
    };
    persist(nextDocument);
  };

  const updateEntity = (update: Partial<TopicalMapDocument['entity']>) => {
    const entity = { ...documentRef.current.entity, ...update };
    const nodes = documentRef.current.nodes.map((node) => {
      const assessment = assessContentBrief(
        node,
        node.contentBrief,
        [...entity.facts, ...node.facts],
        pages,
      );
      if (node.lifecycle === 'drafted' && !assessment.readyToAdvance)
        return { ...node, lifecycle: 'briefed' as const };
      if (node.lifecycle === 'briefed' && !assessment.readyForBrief)
        return { ...node, lifecycle: 'planned' as const };
      return node;
    });
    persist({ ...documentRef.current, entity, nodes });
  };

  return {
    hierarchyNotice,
    setHierarchyNotice,
    draggingNodeId,
    setDraggingNodeId,
    moveTopicalNode,
    dropTopicOn,
    addNode,
    addNodeOnDate,
    updateNode,
    updateEntity,
  };
};
