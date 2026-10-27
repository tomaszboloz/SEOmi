import { CytoscapeMapView } from './cytoscapeMap/CytoscapeMapView';

/** Graph tab: Cytoscape.js map (fcose clusters or dagre hierarchy) with an accessible table alternative. */
export const CrawlArchitectureGraphView = ({ state, crawlMode, pages, startUrl }: any) => (
  <CytoscapeMapView state={state} crawlMode={crawlMode} pages={pages} startUrl={startUrl} />
);
