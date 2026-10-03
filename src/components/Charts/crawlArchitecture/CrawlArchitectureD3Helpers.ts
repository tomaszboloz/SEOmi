import { forceCenter, forceCollide, forceLink, forceManyBody } from 'd3-force';
import { drag } from 'd3-drag';
import type { SimNode, SimLink } from './CrawlArchitectureTypes';
import { WIDTH, HEIGHT, CLUSTER_COLORS } from './CrawlArchitectureTypes';

export const buildSimulationNodesAndLinks = (
  visibleNodes: any[], visibleEdges: any[], visibleTopicEdges: any[], graph: any, preferences: any
) => {
  const clusterColors = new Map<string, string>(graph.clusters.map((cluster: any, index: number) => [cluster.id, CLUSTER_COLORS[index % CLUSTER_COLORS.length]]));
  const nodes: SimNode[] = visibleNodes.map((node) => {
    const savedPosition = preferences.positions[node.page.url];
    return { id: node.id, semanticNode: node, color: clusterColors.get(node.clusterId) ?? '#94a3b8', x: savedPosition?.x, y: savedPosition?.y };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const links: SimLink[] = visibleEdges.map((edge) => ({
    id: edge.id, source: nodeById.get(edge.source)!, target: nodeById.get(edge.target)!, anchors: edge.anchors, links: edge.links, kind: 'content-link', sharedTerms: [], weightedJaccard: 0
  }));
  const topicLinks: SimLink[] = visibleTopicEdges.map((edge) => ({
    id: edge.id, source: nodeById.get(edge.source)!, target: nodeById.get(edge.target)!, anchors: [], links: 0, kind: 'topic-similarity', sharedTerms: edge.sharedTerms, weightedJaccard: edge.weightedJaccard
  }));
  return { nodes, links, topicLinks };
};

export const applySimulationForces = (simulation: any, allForceLinks: SimLink[]) => {
  simulation
    .force('link', forceLink<SimNode, SimLink>(allForceLinks).id((node) => node.id).distance((edge) => edge.kind === 'content-link' ? 100 : 145).strength((edge) => edge.kind === 'content-link' ? 0.45 : 0.12))
    .force('charge', forceManyBody<SimNode>().strength(-230).distanceMax(560))
    .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
    .force('collision', forceCollide<SimNode>().radius((node) => 17 + Math.min(node.semanticNode.semanticSignalCount / 10, 7)).iterations(2))
    .alphaDecay(0.04);
};

export const setupDragBehavior = (nodeElements: any, simulation: any, setPreferences: any) => {
  nodeElements.call(drag<SVGGElement, SimNode>()
    .on('start', (event: any, node: SimNode) => {
      if (!event.active) simulation.alphaTarget(0.25).restart();
      node.fx = node.x; node.fy = node.y;
    })
    .on('drag', (event: any, node: SimNode) => {
      node.fx = event.x; node.fy = event.y;
    })
    .on('end', (event: any, node: SimNode) => {
      if (!event.active) simulation.alphaTarget(0);
      node.fx = null; node.fy = null;
      if (node.x !== undefined && node.y !== undefined) {
        setPreferences((previous: any) => ({
          ...previous,
          positions: Object.entries({ ...previous.positions, [node.semanticNode.page.url]: { x: node.x!, y: node.y! } })
            .slice(-160).reduce((next: any, [url, point]) => { next[url] = point; return next; }, {}),
        }));
      }
    }));
};
