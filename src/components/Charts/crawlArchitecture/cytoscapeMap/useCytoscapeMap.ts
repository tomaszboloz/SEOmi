import { useCallback, useEffect, useRef } from 'react';
import cytoscape, { type Core, type ElementDefinition, type EventObject } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import dagre from 'cytoscape-dagre';
import type { LayoutMode } from './mapTypes';
import { layoutOptions } from './layoutOptions';
import { MAP_STYLE } from './stylesheet';

cytoscape.use(fcose);
cytoscape.use(dagre);

export interface HoverInfo { id: string; x: number; y: number }

export interface CytoscapeMapArgs {
  elements: ElementDefinition[];
  layoutMode: LayoutMode;
  matches: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleSection: (section: string) => void;
  onHover: (info: HoverInfo | null) => void;
}

export const useCytoscapeMap = (args: CytoscapeMapArgs) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const latest = useRef(args);
  latest.current = args;

  useEffect(() => {
    const cy = cytoscape({ container: containerRef.current, style: MAP_STYLE, minZoom: 0.05, maxZoom: 4, wheelSensitivity: 0.3, hideEdgesOnViewport: true, textureOnViewport: true });
    cyRef.current = cy;
    cy.on('tap', 'node', (event: EventObject) => {
      const data = event.target.data();
      if (data.kind === 'page') latest.current.onSelect(data.id);
      else latest.current.onToggleSection(data.section);
    });
    cy.on('mouseover', 'node[kind = "page"]', (event: EventObject) => latest.current.onHover({ id: event.target.id(), ...event.renderedPosition }));
    cy.on('mouseout', 'node', () => latest.current.onHover(null));
    return () => { cy.destroy(); cyRef.current = null; };
  }, []);

  useEffect(() => {
    const cy = cyRef.current!;
    cy.batch(() => { cy.elements().remove(); cy.add(args.elements); });
    cy.layout(layoutOptions(args.layoutMode, args.elements.length)).run();
  }, [args.elements, args.layoutMode]);

  useEffect(() => {
    const cy = cyRef.current!;
    cy.elements().removeClass('dim match');
    if (!args.matches.size) return;
    cy.nodes().forEach((node) => { node.addClass(args.matches.has(node.id()) ? 'match' : 'dim'); });
  }, [args.matches, args.elements]);

  useEffect(() => {
    const cy = cyRef.current!;
    cy.elements().unselect();
    if (args.selectedId) cy.getElementById(args.selectedId).select();
  }, [args.selectedId, args.elements]);

  const zoomBy = useCallback((factor: number) => {
    const cy = cyRef.current;
    if (cy) cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  }, []);
  const fit = useCallback(() => { cyRef.current?.fit(undefined, 24); }, []);
  return { containerRef, zoomBy, fit };
};
