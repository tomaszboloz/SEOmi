import { resolveEntities } from './authors';
import type { SchemaNode } from './graph';
import { classifyProfiles, declarationRecall, reconciliationStatus } from './identifiers';
import type { AuthorEntity, EntityReconciliation, RoleEntity } from './types';

/** Proposed role weights from issue #87 (S_sameAs = .50 author + .25 reviewer + .25 publisher); not calibrated. */
export const ROLE_WEIGHTS = { author: 0.5, reviewer: 0.25, publisher: 0.25 } as const;

const PROPERTIES: Array<[RoleEntity['role'], string]> = [['reviewer', 'reviewedBy'], ['publisher', 'publisher']];

const labelOf = (entity: SchemaNode): string => (entity.id ?? entity.name ?? '').trim();

const reconcile = (role: RoleEntity['role'], sameAs: string[]): EntityReconciliation => {
  const profiles = classifyProfiles(sameAs);
  return { role, profiles, declarationRecall: declarationRecall(profiles), status: reconciliationStatus(profiles), evidence: 'declared' };
};

/** Reviewers and publishers of every article page, merged per role by @id or name; sameAs unioned across pages. */
export const scanRoleEntities = (
  nodesByPage: Map<string, SchemaNode[]>,
  articleNodes: Map<string, SchemaNode[]>,
  registry: Map<string, SchemaNode>,
): RoleEntity[] => {
  const byKey = new Map<string, RoleEntity>();
  for (const [url, articles] of articleNodes) {
    const siblings = nodesByPage.get(url) ?? [];
    for (const article of articles) {
      for (const [role, property] of PROPERTIES) {
        for (const entity of resolveEntities(article, property, siblings, registry)) {
          const label = labelOf(entity);
          if (!label) continue;
          const key = `${role}|${label.toLowerCase()}`;
          const found = byKey.get(key)
            ?? { role, key, name: entity.name ?? label, id: entity.id, sameAs: [], articleUrls: [], reconciliation: reconcile(role, []) };
          (entity.props.sameAs ?? []).forEach((value) => { if (!found.sameAs.includes(value)) found.sameAs.push(value); });
          if (!found.articleUrls.includes(url)) found.articleUrls.push(url);
          found.reconciliation = reconcile(role, found.sameAs);
          byKey.set(key, found);
        }
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.role.localeCompare(b.role)
    || b.articleUrls.length - a.articleUrls.length || a.name.localeCompare(b.name));
};

const meanRecall = (items: Array<{ reconciliation?: EntityReconciliation }>): number | undefined => (items.length
  ? items.reduce((sum, item) => sum + (item.reconciliation?.declarationRecall ?? 0), 0) / items.length
  : undefined);

/**
 * Role-weighted declaration recall 0-1. A role with no named entity is unknown,
 * not zero: its weight is dropped and the rest renormalized. Undefined when no role is named.
 * Declaration recall only: it never claims that an identity was verified.
 */
export const roleWeightedRecall = (authors: AuthorEntity[], roles: RoleEntity[]): number | undefined => {
  const parts: Array<[number, number | undefined]> = [
    [ROLE_WEIGHTS.author, meanRecall(authors.filter((author) => !author.generic))],
    [ROLE_WEIGHTS.reviewer, meanRecall(roles.filter((entity) => entity.role === 'reviewer'))],
    [ROLE_WEIGHTS.publisher, meanRecall(roles.filter((entity) => entity.role === 'publisher'))],
  ];
  const known = parts.filter((part): part is [number, number] => part[1] !== undefined);
  const total = known.reduce((sum, [weight]) => sum + weight, 0);
  return total ? known.reduce((sum, [weight, recall]) => sum + weight * recall, 0) / total : undefined;
};
