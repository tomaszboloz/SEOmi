import type { StylesheetJson } from 'cytoscape';

export const MAP_STYLE: StylesheetJson = [
  { selector: 'node', style: { 'background-color': 'data(color)', width: 'data(size)', height: 'data(size)', label: 'data(label)', color: '#cbd5e1', 'font-size': 9, 'text-valign': 'bottom', 'text-margin-y': 3, 'min-zoomed-font-size': 7, 'border-width': 1, 'border-color': '#0f172a' } },
  { selector: 'node[kind = "section"]', style: { shape: 'round-rectangle', 'text-valign': 'center', 'text-margin-y': 0, 'font-size': 10, color: '#f1f5f9', 'text-wrap': 'wrap', 'border-color': '#94a3b8' } },
  { selector: 'node[kind = "group"]', style: { shape: 'round-rectangle', 'background-opacity': 0.08, 'background-color': '#94a3b8', 'border-width': 1, 'border-color': '#475569', 'text-valign': 'top', 'font-size': 11, color: '#94a3b8', width: 'label', height: 'label' } },
  { selector: 'edge', style: { width: 'data(weight)', 'line-color': '#475569', 'target-arrow-color': '#64748b', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.7, 'curve-style': 'bezier', opacity: 0.55 } },
  { selector: '.dim', style: { opacity: 0.15 } },
  { selector: '.match', style: { 'border-width': 3, 'border-color': '#f8fafc', 'z-index': 10 } },
  { selector: ':selected', style: { 'border-width': 3, 'border-color': '#38bdf8' } },
];
