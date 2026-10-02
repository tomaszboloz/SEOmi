import type { TopicalMapDocument, TopicalEntityFact, TopicalNode } from './types';
import { MAX_FACTS, MAX_NODES, cleanText } from './primitives';
import { normalizeFact } from './fact';
import { normalizeNode } from './node';
import { createEmptyTopicalMap } from './factories';
export const normalizeTopicalMap = (raw: unknown): TopicalMapDocument => {
  if (!raw || typeof raw !== 'object') return createEmptyTopicalMap();
  const value = raw as Record<string, unknown>;
  const rawEntity = value.entity && typeof value.entity === 'object' ? value.entity as Record<string, unknown> : {};
  const entityFacts = Array.isArray(rawEntity.facts) ? rawEntity.facts.slice(0, MAX_FACTS).map(normalizeFact).filter((fact): fact is TopicalEntityFact => Boolean(fact)) : [];
  const nodes = Array.isArray(value.nodes) ? value.nodes.slice(0, MAX_NODES).map(normalizeNode).filter((node): node is TopicalNode => Boolean(node)) : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const node of nodes) node.relatedNodeIds = node.relatedNodeIds.filter((relatedId) => nodeIds.has(relatedId));
  // Reject self/unknown parents and break persisted cycles deterministically.
  for (const node of nodes) {
    if (!node.parentId || !nodeIds.has(node.parentId) || node.parentId === node.id) { node.parentId = null; continue; }
    let cursor: string | null = node.parentId;
    const seen = new Set([node.id]);
    while (cursor) {
      if (seen.has(cursor)) { node.parentId = null; break; }
      seen.add(cursor);
      cursor = nodes.find((candidate) => candidate.id === cursor)?.parentId ?? null;
    }
  }
  return {
    schemaVersion: 1,
    entity: { name: cleanText(rawEntity.name, 180), description: cleanText(rawEntity.description, 5000), facts: entityFacts },
    nodes,
    updatedAt: cleanText(value.updatedAt, 40) || new Date().toISOString(),
  };
};
