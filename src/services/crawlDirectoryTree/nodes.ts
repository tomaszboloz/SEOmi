import { CrawlDirectoryNode } from "./contracts";
import { emptyMetrics } from "./metrics";

export const decodeSegment = (segment: string): string => {
  try { return decodeURIComponent(segment); } catch { return segment; }
};

export const makeNode = (id: string, name: string, depth: number): CrawlDirectoryNode => ({
  id,
  name,
  depth,
  ownPages: [],
  childDirectories: [],
  metrics: emptyMetrics(),
});
