import type { GscMetricRow, GscPerformanceData, GscPerformanceFilters } from '@/types';
import type { TrafficDateRange, TrafficPropertyScope } from './trafficEvidenceNormalization';
import { normalizeTrafficDateRange, normalizeTrafficFilters, normalizeTrafficMetric, normalizeTrafficProperty, normalizeTrafficUrl, sameTrafficFilters, trafficPropertyMatchesUrl } from './trafficEvidenceNormalization';

export interface TrafficGraphNode {
  id: string;
  url?: unknown;
  final_url?: unknown;
  finalUrl?: unknown;
  page?: { url?: unknown; final_url?: unknown; finalUrl?: unknown };
}

export interface TrafficEvidenceRequest {
  projectId: unknown;
  property: unknown;
  startDate: unknown;
  endDate: unknown;
  filters?: unknown;
  nodes: TrafficGraphNode[];
  gscData?: GscPerformanceData | null;
}

export type TrafficEvidenceStatus = 'complete' | 'partial' | 'unavailable' | 'invalid';
export type TrafficObservation = 'gsc' | 'missing' | 'truncated' | 'unavailable' | 'invalid' | 'out-of-scope' | 'ambiguous';

export interface TrafficMetrics { clicks: number | null; impressions: number | null; ctr: number | null; position: number | null; }
export interface TrafficNodeEvidence { nodeId: string; urls: string[]; metrics: TrafficMetrics; observed: boolean; observation: TrafficObservation; }

export interface TrafficEvidence {
  status: TrafficEvidenceStatus;
  projectId: string | null;
  property: TrafficPropertyScope | null;
  dateRange: TrafficDateRange | null;
  filters: GscPerformanceFilters | null;
  nodes: TrafficNodeEvidence[];
  matchedNodeIds: string[];
  missingNodeIds: string[];
  uncertainNodeIds: string[];
  outOfScopeNodeIds: string[];
  ambiguousNodeIds: string[];
  ignoredRows: number;
  invalidRows: number;
  truncated: boolean;
  errors: string[];
}

const emptyMetrics = (): TrafficMetrics => ({ clicks: null, impressions: null, ctr: null, position: null });
const project = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const rowMetrics = (row: Partial<GscMetricRow>): TrafficMetrics | null => {
  const values = [row.clicks, row.impressions, row.ctr, row.position].map(normalizeTrafficMetric);
  return values.every((value) => value !== null) ? { clicks: values[0], impressions: values[1], ctr: values[2], position: values[3] } : null;
};
const nodeUrls = (node: TrafficGraphNode | null | undefined): string[] => {
  if (!node || typeof node !== 'object') return [];
  const page = node.page ?? {};
  return [...new Set([node.url, node.final_url, node.finalUrl, page.url, page.final_url, page.finalUrl]
    .map(normalizeTrafficUrl).filter(Boolean))];
};
const blankNodes = (nodes: TrafficGraphNode[], observation: TrafficObservation): TrafficNodeEvidence[] =>
  nodes.map((node, index) => ({ nodeId: typeof node?.id === 'string' ? node.id : `invalid-${index}`, urls: nodeUrls(node), metrics: emptyMetrics(), observed: false, observation }));

const invalidResult = (request: Partial<TrafficEvidenceRequest> | null, errors: string[]): TrafficEvidence => ({
  status: 'invalid', projectId: project(request?.projectId), property: null, dateRange: null, filters: null,
  nodes: blankNodes(Array.isArray(request?.nodes) ? request.nodes : [], 'invalid'), matchedNodeIds: [], missingNodeIds: [], uncertainNodeIds: [],
  outOfScopeNodeIds: [], ambiguousNodeIds: [], ignoredRows: 0, invalidRows: 0, truncated: false, errors,
});

export function buildTrafficEvidence(request: TrafficEvidenceRequest): TrafficEvidence {
  const errors: string[] = [];
  if (!request || !Array.isArray(request.nodes)) return invalidResult(request && typeof request === 'object' ? request as Partial<TrafficEvidenceRequest> : null, ['nodes are required']);
  const projectId = project(request.projectId);
  const property = normalizeTrafficProperty(request.property);
  const dateRange = normalizeTrafficDateRange(request.startDate, request.endDate);
  const filters = normalizeTrafficFilters(request.filters);
  if (!projectId) errors.push('projectId is required');
  if (!property) errors.push('property is invalid');
  if (!dateRange) errors.push('date range is invalid');
  if (!filters) errors.push('filters are invalid');
  const ids = request.nodes.map((node) => node?.id);
  if (ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) errors.push('node ids must be unique and non-empty');
  if (errors.length || !projectId || !property || !dateRange || !filters) return { ...invalidResult(request, errors), projectId, property, dateRange, filters };
  const baseNodes = request.nodes.map((node) => ({ nodeId: node.id, urls: nodeUrls(node), metrics: emptyMetrics(), observed: false, observation: 'missing' as TrafficObservation }));
  const data = request.gscData;
  if (!data) return finish(baseNodes.map((node) => ({ ...node, observation: 'unavailable' })), { status: 'unavailable', projectId, property, dateRange, filters, errors: ['GSC data is unavailable'] });
  const sourceProperty = normalizeTrafficProperty(data.site_url);
  const sourceRange = normalizeTrafficDateRange(data.start_date, data.end_date);
  const sourceFilters = normalizeTrafficFilters(data.filters);
  if (!sourceProperty || sourceProperty.key !== property.key) errors.push('GSC property does not match the request');
  if (!sourceRange || sourceRange.startDate !== dateRange.startDate || sourceRange.endDate !== dateRange.endDate) errors.push('GSC date range does not match the request');
  if (!sourceFilters || !sameTrafficFilters(sourceFilters, filters)) errors.push('GSC filters do not match the request');
  if (!Array.isArray(data.pages)) errors.push('GSC page rows are invalid');
  if (errors.length || !property || !dateRange || !filters) return { ...invalidResult(request, errors), projectId, property, dateRange, filters };
  return joinRows(baseNodes, data, { projectId, property, dateRange, filters });
}

const finish = (nodes: TrafficNodeEvidence[], meta: Pick<TrafficEvidence, 'status' | 'projectId' | 'property' | 'dateRange' | 'filters' | 'errors'>): TrafficEvidence => {
  const matchedNodeIds = nodes.filter((node) => node.observed).map((node) => node.nodeId).sort();
  const outOfScopeNodeIds = nodes.filter((node) => node.observation === 'out-of-scope').map((node) => node.nodeId).sort();
  const ambiguousNodeIds = nodes.filter((node) => node.observation === 'ambiguous').map((node) => node.nodeId).sort();
  const uncertainNodeIds = nodes.filter((node) => node.observation === 'truncated').map((node) => node.nodeId).sort();
  const missingNodeIds = nodes.filter((node) => node.observation === 'missing').map((node) => node.nodeId).sort();
  return { ...meta, nodes: [...nodes].sort((left, right) => left.nodeId < right.nodeId ? -1 : left.nodeId > right.nodeId ? 1 : 0), matchedNodeIds, missingNodeIds, uncertainNodeIds, outOfScopeNodeIds, ambiguousNodeIds, ignoredRows: 0, invalidRows: 0, truncated: false };
};

const joinRows = (initial: TrafficNodeEvidence[], data: GscPerformanceData, meta: Pick<TrafficEvidence, 'projectId' | 'property' | 'dateRange' | 'filters'>): TrafficEvidence => {
  const aliases = new Map<string, string[]>();
  initial.forEach((node) => node.urls.forEach((url) => aliases.set(url, [...(aliases.get(url) ?? []), node.nodeId])));
  const rows = new Map<string, TrafficMetrics>();
  const invalidUrls = new Set<string>();
  let ignoredRows = 0; let invalidRows = 0;
  (data.pages as unknown[]).forEach((raw) => {
    const row = (raw ?? {}) as Partial<GscMetricRow>;
    const url = normalizeTrafficUrl(row.page);
    if (!url) { invalidRows += 1; return; }
    if (!trafficPropertyMatchesUrl(meta.property!, url)) { ignoredRows += 1; return; }
    if (invalidUrls.has(url)) { invalidRows += 1; return; }
    const metrics = rowMetrics(row);
    if (!metrics) { rows.delete(url); invalidUrls.add(url); invalidRows += 1; return; }
    if (rows.has(url)) { rows.delete(url); invalidUrls.add(url); invalidRows += 1; return; }
    rows.set(url, metrics);
  });
  const nodes = initial.map((node) => {
    const matches = [...new Set(node.urls.flatMap((url) => aliases.get(url) ?? []))];
    const inScope = node.urls.some((url) => trafficPropertyMatchesUrl(meta.property!, url));
    if (!inScope) return { ...node, observation: 'out-of-scope' as TrafficObservation };
    if (matches.length !== 1) return { ...node, observation: matches.length > 1 ? 'ambiguous' as TrafficObservation : data.pages_may_be_truncated ? 'truncated' as TrafficObservation : 'missing' as TrafficObservation };
    const rowUrl = node.urls.find((url) => rows.has(url));
    if (!rowUrl) return { ...node, observation: data.pages_may_be_truncated ? 'truncated' as TrafficObservation : 'missing' as TrafficObservation };
    return { ...node, metrics: rows.get(rowUrl)!, observed: true, observation: 'gsc' as TrafficObservation };
  });
  const status: TrafficEvidenceStatus = data.pages_may_be_truncated || invalidRows > 0 || ignoredRows > 0 ? 'partial' : 'complete';
  return { ...finish(nodes, { ...meta, status, errors: [] }), ignoredRows, invalidRows, truncated: data.pages_may_be_truncated === true };
};

export const joinGscTraffic = buildTrafficEvidence;
