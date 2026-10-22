import type { LayoutOptions } from 'cytoscape';
import type { LayoutMode } from './mapTypes';

/** Above this many elements fcose switches to its faster draft quality. */
export const DRAFT_THRESHOLD = 1500;

export const layoutOptions = (mode: LayoutMode, elementCount: number): LayoutOptions =>
  mode === 'hierarchy'
    ? ({ name: 'dagre', rankDir: 'TB', nodeSep: 18, rankSep: 60, animate: false, fit: true, padding: 24 } as LayoutOptions)
    : ({ name: 'fcose', quality: elementCount > DRAFT_THRESHOLD ? 'draft' : 'default', randomize: true, animate: false, fit: true, padding: 24, nodeRepulsion: 6500, idealEdgeLength: 70, nestingFactor: 0.2, packComponents: true } as LayoutOptions);
