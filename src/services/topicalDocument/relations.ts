import type { TopicalMapDocument } from './types';
export const setTopicalNodeParent = (document: TopicalMapDocument, nodeId: string, parentId: string | null): TopicalMapDocument => {
  if (parentId === nodeId || (parentId && !document.nodes.some((node) => node.id === parentId))) return document;
  let cursor = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === nodeId || seen.has(cursor)) return document;
    seen.add(cursor);
    cursor = document.nodes.find((node) => node.id === cursor)?.parentId ?? null;
  }
  return { ...document, nodes: document.nodes.map((node) => node.id === nodeId ? { ...node, parentId } : node) };
};

export const toggleTopicalLateralRelation = (document: TopicalMapDocument, nodeId: string, relatedId: string): TopicalMapDocument => {
  if (nodeId === relatedId || !document.nodes.some((node) => node.id === nodeId) || !document.nodes.some((node) => node.id === relatedId)) return document;
  const isRelated = document.nodes.find((node) => node.id === nodeId)!.relatedNodeIds.includes(relatedId);
  return {
    ...document,
    nodes: document.nodes.map((node) => node.id === nodeId
      ? { ...node, relatedNodeIds: isRelated ? node.relatedNodeIds.filter((id) => id !== relatedId) : [...node.relatedNodeIds, relatedId] }
      : node.id === relatedId
        ? { ...node, relatedNodeIds: isRelated ? node.relatedNodeIds.filter((id) => id !== nodeId) : [...node.relatedNodeIds, nodeId] }
        : node),
  };
};

export const setNodeParentFromInput = setTopicalNodeParent;
