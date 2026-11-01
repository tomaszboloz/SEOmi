import type { HssModule } from '@/services/hss';

export type ActionSource = 'sfs' | 'tas' | 'eetv' | 'links' | 'sprs' | 'aior';
/** Existing workspace screen the action drills down to; the dashboard only navigates, it never recomputes. */
export type ActionDrillTab = 'focus' | 'authority' | 'trust' | 'visualisations' | 'aio';

export interface ActionEvidence {
  source: ActionSource;
  code: string;
  params?: Record<string, unknown>;
  items?: string[];
}

/** Effort range carried over from the engine that emitted the action; always an estimate, never measured hours. */
export interface ActionEffort { minHours: number; maxHours: number; estimate: true }

/** Gain from the emitting engine's own declared simulation (SFS deltaScore, TAS deltaTas). */
export interface ModuleDelta { module: HssModule; value: number }

export type ActionConflictKind = 'protected-by-evidence' | 'needs-data' | 'merge-vs-expand' | 'keep-vs-prune';

export interface ActionConflict { kind: ActionConflictKind; urls: string[]; withAction?: string }

export interface ExecutiveAction {
  /** Stable id from project/run/type/URLs (GEM-89-01). */
  id: string;
  type: string;
  source: ActionSource;
  urls: string[];
  evidence: ActionEvidence[];
  effort: ActionEffort | null;
  moduleDelta: ModuleDelta | null;
  /** HSS delta from a What-If on a copy of the baseline; null when no model or no shown HSS. */
  hssDelta: number | null;
  conflicts: ActionConflict[];
  /** Ids of actions that must be done first. */
  dependsOn: string[];
  /** Business guardrail (#81) or arbitration stopped the action: shown, never ranked above open work. */
  blocked: boolean;
  drillTab: ActionDrillTab;
}
