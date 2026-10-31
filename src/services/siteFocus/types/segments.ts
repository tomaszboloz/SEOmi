import type { CoreTopicMode } from './page';
import type { SfsBand } from './base';

/** A user-defined part of a multi-topic site (#82 GEM-82-05) with an optional topic of its own. */
export interface FocusSegmentInput { label: string; pathPrefix: string; topic?: string }

/** SFS of one user segment against its own Core Topic; `score: null` when no page under it was scored. */
export interface SegmentFocus extends FocusSegmentInput {
  source: 'user';
  pageCount: number;
  scoredCount: number;
  score: number | null;
  band: SfsBand | 'unavailable';
  coreLabel: string;
  coreMode: CoreTopicMode;
}
