import { useEffect, useRef } from 'react';
import { forceSimulation } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { WIDTH, HEIGHT } from './CrawlArchitectureTypes';
import type { SimNode, SimLink } from './CrawlArchitectureTypes';
import { shortUrl } from './CrawlArchitectureHelpers';
import { buildSimulationNodesAndLinks, applySimulationForces, setupDragBehavior } from './CrawlArchitectureD3Helpers';

export const useCrawlArchitectureSimulation = ({
  svgRef, graphLayerRef, graph, preferences, setPreferences, setSelectedId,
  selectedId, visibleNodes, visibleEdges, visibleTopicEdges, t, markerId
}: any) => {
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    const svgElement = svgRef.current;
    const graphLayer = graphLayerRef.current;
    if (!svgElement || !graphLayer) return;

    const { nodes, links, topicLinks } = buildSimulationNodesAndLinks(visibleNodes, visibleEdges, visibleTopicEdges, graph, preferences);
    const root = select(graphLayer);

    const topicElements = root.selectAll<SVGLineElement, SimLink>('line.topic-similarity-edge')
      .data(topicLinks, (edge) => edge.id).join('line').attr('class', 'topic-similarity-edge').attr('stroke', '#38bdf8')
      .attr('stroke-opacity', 0.34).attr('stroke-dasharray', '3 5').attr('stroke-width', (edge) => 0.8 + Math.min(edge.weightedJaccard * 2, 1.2))
      .attr('aria-label', (edge) => t('mapUi.edgeSimilarityAria', { percent: Math.round(edge.weightedJaccard * 100), terms: edge.sharedTerms.join(', ') }));

    const linkElements = root.selectAll<SVGLineElement, SimLink>('line.semantic-edge')
      .data(links, (edge) => edge.id).join('line').attr('class', 'semantic-edge').attr('stroke', '#64748b')
      .attr('stroke-opacity', 0.55).attr('stroke-width', (edge) => Math.min(1 + Math.log2(edge.links), 4)).attr('marker-end', `url(#${markerId})`);

    const nodeElements = root.selectAll<SVGGElement, SimNode>('g.semantic-node')
      .data(nodes, (node) => node.id)
      .join((enter) => {
        const group = enter.append('g').attr('class', 'semantic-node').style('cursor', 'grab');
        group.append('circle').attr('r', (node) => 7 + Math.min(node.semanticNode.semanticSignalCount / 10, 7)).attr('stroke', '#0f172a').attr('stroke-width', 2);
        group.append('text').attr('dy', 23).attr('text-anchor', 'middle').attr('fill', '#cbd5e1').attr('font-size', 10).attr('pointer-events', 'none');
        return group;
      })
      .attr('aria-label', (node) => t('mapUi.nodeAria', { label: node.semanticNode.page.title || shortUrl(node.semanticNode.page.url), cluster: node.semanticNode.clusterLabel }))
      .attr('role', 'button').attr('tabindex', '0').attr('focusable', 'true').attr('aria-pressed', (node) => node.id === selectedId ? 'true' : 'false')
      .on('click', (_event, node) => setSelectedId(node.id))
      .on('keydown', (event, node) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault(); setSelectedId(node.id);
      });

    nodeElements.select<SVGCircleElement>('circle').attr('fill', (node) => node.color);
    nodeElements.select<SVGTextElement>('text').text((node) => shortUrl(node.semanticNode.page.url).slice(0, 34));

    const simulation = forceSimulation(nodes);
    applySimulationForces(simulation, [...links, ...topicLinks]);
    
    simulation.on('tick', () => {
      const positionEdges = (elements: any) => elements
        .attr('x1', (edge: any) => edge.source.x ?? WIDTH / 2).attr('y1', (edge: any) => edge.source.y ?? HEIGHT / 2)
        .attr('x2', (edge: any) => {
          const dx = (edge.target.x ?? WIDTH / 2) - (edge.source.x ?? WIDTH / 2);
          const distance = Math.hypot(dx, (edge.target.y ?? HEIGHT / 2) - (edge.source.y ?? HEIGHT / 2)) || 1;
          const radius = 10 + Math.min(edge.target.semanticNode.semanticSignalCount / 10, 7);
          return (edge.target.x ?? WIDTH / 2) - (dx / distance) * radius;
        })
        .attr('y2', (edge: any) => {
          const dy = (edge.target.y ?? HEIGHT / 2) - (edge.source.y ?? HEIGHT / 2);
          const distance = Math.hypot((edge.target.x ?? WIDTH / 2) - (edge.source.x ?? WIDTH / 2), dy) || 1;
          const radius = 10 + Math.min(edge.target.semanticNode.semanticSignalCount / 10, 7);
          return (edge.target.y ?? HEIGHT / 2) - (dy / distance) * radius;
        });
      positionEdges(topicElements); positionEdges(linkElements);
      nodeElements.attr('transform', (node) => `translate(${node.x ?? WIDTH / 2},${node.y ?? HEIGHT / 2})`);
    });

    setupDragBehavior(nodeElements, simulation, setPreferences);

    const zoomBehavior = zoom<SVGSVGElement, unknown>().extent([[0, 0], [WIDTH, HEIGHT]]).scaleExtent([0.2, 4])
      .on('zoom', (event) => root.attr('transform', event.transform.toString()))
      .on('end.persist', (event) => {
        const { x, y, k } = event.transform;
        setPreferences((previous: any) => (previous.transform.x === x && previous.transform.y === y && previous.transform.k === k) ? previous : { ...previous, transform: { x, y, k } });
      });
    zoomRef.current = zoomBehavior;
    select(svgElement).call(zoomBehavior);
    select(svgElement).call(zoomBehavior.transform, zoomIdentity.translate(preferences.transform.x, preferences.transform.y).scale(preferences.transform.k));

    return () => { simulation.stop(); select(svgElement).on('.zoom', null); };
  }, [graph.clusters, markerId, preferences.positions, selectedId, visibleEdges, visibleNodes, visibleTopicEdges, t, setPreferences, setSelectedId]);

  return { zoomRef };
};
