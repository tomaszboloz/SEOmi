import type { EntityReconciliation, EntityRole, TrustSeverity } from './types';

export type TrustGraphRole = 'document' | 'author' | 'reviewer' | 'publisher';
export interface TrustGraphEntity {
  key: string;
  id?: string;
  names: string[];
  types: string[];
  roles: TrustGraphRole[];
  sameAs: string[];
  aliases: string[];
  profileUrls: string[];
  sourcePages: string[];
  declarations: Array<{ sourcePage: string; declaration: number; nodePath: string }>;
  reconciliations?: Partial<Record<EntityRole, EntityReconciliation>>;
  complete: boolean;
}
export interface TrustGraphEdge {
  from: string;
  to: string;
  role: Exclude<TrustGraphRole, 'document'>;
  property: string;
  sourcePage: string;
  declaration: number;
  nodePath: string;
  rawValue: string;
}
export interface TrustGraphDiagnostic {
  code: 'conflicting-definition' | 'dangling-reference' | 'indeterminate-reference' | 'incomplete-definition' | 'cycle' | 'role-overlap' | 'graph-truncated';
  severity: TrustSeverity;
  sourcePage?: string;
  declaration?: number;
  nodePath?: string;
  entityKey?: string;
  target?: string;
}
export interface TrustGraph {
  entities: TrustGraphEntity[];
  edges: TrustGraphEdge[];
  diagnostics: TrustGraphDiagnostic[];
}
