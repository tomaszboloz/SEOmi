import type { EntityReconciliation, EntityRole, ProfileEvidence, TrustGraph } from './types';
import { classifyProfiles, declarationRecall } from './identifiers';

export const registryEvidenceKey = (entityKey: string, role: EntityRole, url: string): string =>
  [role, entityKey, url].join('\u0000');

/** Identity decisions belong to one entity and role. Legacy URL-only fetch observations remain observations. */
export const applyRegistryEvidence = (profiles: ProfileEvidence[], entityKey: string, role: EntityRole,
  evidence: Record<string, ProfileEvidence>): ProfileEvidence[] => profiles.map((profile) => {
  const scoped = evidence[registryEvidenceKey(entityKey, role, profile.url)];
  if (scoped?.url === profile.url && scoped.kind === profile.kind && scoped.id === profile.id) return scoped;
  const legacy = evidence[profile.url];
  return legacy?.url === profile.url && !['verified', 'mismatch'].includes(legacy.status) ? legacy : profile;
});

export const reconciliationFor = (role: EntityRole, profiles: ProfileEvidence[], evidence: 'declared' | 'registry'): EntityReconciliation => ({
  role, profiles, declarationRecall: declarationRecall(profiles), evidence,
  status: (['mismatch', 'invalid', 'verified', 'fetched', 'syntax-valid', 'declared', 'unavailable'] as const)
    .find((status) => profiles.some((profile) => profile.status === status)) ?? 'unavailable',
});

export const decorateRegistryGraph = (graph: TrustGraph, evidence: Record<string, ProfileEvidence> = {}): void => {
  for (const entity of graph.entities) {
    const declared = classifyProfiles(entity.sameAs);
    entity.reconciliations = {};
    for (const role of entity.roles) {
      if (role === 'document') continue;
      const profiles = applyRegistryEvidence(declared, entity.id ?? entity.key, role, evidence);
      entity.reconciliations[role] = reconciliationFor(role, profiles,
        profiles.some((profile, index) => profile !== declared[index]) ? 'registry' : 'declared');
    }
  }
};
