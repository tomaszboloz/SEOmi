import type { CrawledPageSummary } from '@/types';
import { childNodes, canonicalId, isArticleNode, isCompleteDefinition, nodeIdentity, nodesOf, type SchemaNode } from './graph';
import type { TrustGraph, TrustGraphDiagnostic, TrustGraphEdge, TrustGraphEntity, TrustGraphRole } from './types';

type Role = Exclude<TrustGraphRole, 'document'>;
const roleOf: Record<string, Role | undefined> = { author: 'author', reviewedBy: 'reviewer', publisher: 'publisher' };
const idLike = /^(?:https?:\/\/|#|\/|\.\.?(?:\/|$))/i;
const urlOf = (page: CrawledPageSummary): string => page.final_url || page.url;
const unique = (list: string[], value: string): void => { if (!list.includes(value)) list.push(value); };
const entityKey = (node: SchemaNode): string => `id:${nodeIdentity(node)}`;
const locationKey = (node: SchemaNode): string => `node:${node.page}|${node.decl}|${node.path}`;
const diagnosticKeys = new WeakMap<TrustGraphDiagnostic[], Set<string>>();

const entityFor = (map: Map<string, TrustGraphEntity>, key: string, node: Partial<SchemaNode>, roles: TrustGraphRole[] = []): TrustGraphEntity => {
  const entity = map.get(key) ?? { key, id: node.id ? canonicalId(node.id, node.page ?? '') : undefined, names: [], types: [], roles: [], sameAs: [], aliases: [], profileUrls: [], sourcePages: [], declarations: [], complete: false };
  if (node.name) unique(entity.names, node.name);
  (node.types ?? []).forEach((type) => unique(entity.types, type));
  (node.props?.sameAs ?? []).forEach((alias) => unique(entity.sameAs, alias));
  (node.props?.alternateName ?? []).forEach((alias) => unique(entity.aliases, alias));
  (node.props?.url ?? []).forEach((url) => unique(entity.profileUrls, url));
  if (node.page) unique(entity.sourcePages, node.page);
  if (node.page && node.decl !== undefined && node.path) {
    if (!entity.declarations.some((item) => item.sourcePage === node.page && item.declaration === node.decl && item.nodePath === node.path)) entity.declarations.push({ sourcePage: node.page, declaration: node.decl, nodePath: node.path });
  }
  roles.forEach((role) => unique(entity.roles, role));
  entity.complete = entity.complete || Boolean(node.types?.length || node.name);
  map.set(key, entity);
  return entity;
};

const diagnostic = (diagnostics: TrustGraphDiagnostic[], item: TrustGraphDiagnostic): void => {
  const key = [item.code, item.entityKey, item.target, item.sourcePage, item.declaration, item.nodePath].join('|');
  let keys = diagnosticKeys.get(diagnostics);
  if (!keys) { keys = new Set(diagnostics.map((old) => [old.code, old.entityKey, old.target, old.sourcePage, old.declaration, old.nodePath].join('|'))); diagnosticKeys.set(diagnostics, keys); }
  if (!keys.has(key)) { keys.add(key); diagnostics.push(item); }
};

const definitionDiagnostics = (nodes: SchemaNode[], diagnostics: TrustGraphDiagnostic[]): void => {
  const byId = new Map<string, SchemaNode[]>();
  nodes.filter((node) => node.id).forEach((node) => { const key = nodeIdentity(node); const definitions = byId.get(key); if (definitions) definitions.push(node); else byId.set(key, [node]); });
  for (const [key, definitions] of byId) {
    const names = new Set(definitions.map((node) => node.name).filter(Boolean));
    const person = definitions.some((node) => node.types.includes('Person'));
    const organization = definitions.some((node) => /Organization|LocalBusiness|Corporation|Hospital|Clinic/i.test(node.types.join(' ')));
    const first = definitions[0];
    if (names.size > 1 || (person && organization)) diagnostic(diagnostics, { code: 'conflicting-definition', severity: 'warning', sourcePage: first.page, declaration: first.decl, nodePath: first.path, entityKey: `id:${key}` });
    if (!definitions.some(isCompleteDefinition)) diagnostic(diagnostics, { code: 'incomplete-definition', severity: 'info', sourcePage: first.page, declaration: first.decl, nodePath: first.path, entityKey: `id:${key}` });
  }
};

const targetFor = (value: string, source: SchemaNode, role: Role, byId: Map<string, SchemaNode[]>, entities: Map<string, TrustGraphEntity>): string => {
  if (idLike.test(value)) {
    const id = canonicalId(value, source.page);
    const known = id ? (byId.get(id) ?? []).find(isCompleteDefinition) ?? byId.get(id)?.[0] : undefined;
    if (known) return entityFor(entities, entityKey(known), known, [role]).key;
    const key = `id:${id ?? value}`;
    entityFor(entities, key, { page: source.page, decl: source.decl, path: source.path, id: id ?? value, types: [], props: {} }, [role]);
    return key;
  }
  const key = `value:${source.page}|${source.decl}|${source.path}|${role}|${value}`;
  entityFor(entities, key, { page: source.page, decl: source.decl, path: source.path, name: value, types: [], props: {} }, [role]);
  return key;
};

const unresolved = (pages: CrawledPageSummary[], source: SchemaNode, value: string, diagnostics: TrustGraphDiagnostic[], target: string, resolved: boolean): void => {
  if (!idLike.test(value)) return;
  if (resolved) return;
  let external = false;
  try { external = !pages.some((page) => new URL(urlOf(page)).host === new URL(target).host); } catch { external = false; }
  if (external) return;
  const page = pages.find((candidate) => urlOf(candidate) === source.page);
  let targetCrawled = false;
  try {
    const targetUrl = new URL(target);
    targetCrawled = pages.some((candidate) => { const crawledUrl = new URL(urlOf(candidate)); return crawledUrl.origin === targetUrl.origin && crawledUrl.pathname === targetUrl.pathname; });
  } catch { targetCrawled = false; }
  const uncertain = !page || !targetCrawled || page.body_truncated === true || page.schema_validation_truncated === true;
  diagnostic(diagnostics, { code: uncertain ? 'indeterminate-reference' : 'dangling-reference', severity: uncertain ? 'info' : 'warning', sourcePage: source.page, declaration: source.decl, nodePath: source.path, target });
};

const cycles = (edges: TrustGraphEdge[], diagnostics: TrustGraphDiagnostic[]): void => {
  const maxSteps = 100_000; let steps = 0;
  const next = new Map<string, TrustGraphEdge[]>();
  edges.forEach((edge) => { const outgoing = next.get(edge.from); if (outgoing) outgoing.push(edge); else next.set(edge.from, [edge]); });
  const colours = new Map<string, 0 | 1 | 2>(); const seen = new Set<string>();
  for (const start of next.keys()) {
    if (colours.has(start)) continue;
    colours.set(start, 1);
    const stack: Array<{ key: string; index: number }> = [{ key: start, index: 0 }];
    while (stack.length) {
      if (++steps > maxSteps) { diagnostic(diagnostics, { code: 'graph-truncated', severity: 'info' }); return; }
      const frame = stack[stack.length - 1]; const outgoing = next.get(frame.key) ?? [];
      if (frame.index >= outgoing.length) { colours.set(frame.key, 2); stack.pop(); continue; }
      const edge = outgoing[frame.index++]; const colour = colours.get(edge.to);
      if (colour === 1) { const marker = `${edge.from}>${edge.to}`; if (!seen.has(marker)) { seen.add(marker); diagnostic(diagnostics, { code: 'cycle', severity: 'info', sourcePage: edge.sourcePage, declaration: edge.declaration, nodePath: edge.nodePath, entityKey: edge.from, target: edge.to }); } }
      else if (colour === undefined) { colours.set(edge.to, 1); stack.push({ key: edge.to, index: 0 }); }
    }
  }
};

export const buildTrustGraph = (pages: CrawledPageSummary[], nodesByPage = new Map(pages.map((page) => [urlOf(page), nodesOf(page)]))): TrustGraph => {
  const entities = new Map<string, TrustGraphEntity>(); const edges: TrustGraphEdge[] = []; const diagnostics: TrustGraphDiagnostic[] = [];
  const nodes = [...nodesByPage.values()].flat(); const byId = new Map<string, SchemaNode[]>();
  nodes.filter((node) => node.id).forEach((node) => { const id = nodeIdentity(node); const definitions = byId.get(id); if (definitions) definitions.push(node); else byId.set(id, [node]); });
  definitionDiagnostics(nodes, diagnostics);
  for (const node of nodes) {
    const source = isArticleNode(node) ? entityFor(entities, node.id ? entityKey(node) : locationKey(node), node, ['document']) : node.id ? entityFor(entities, entityKey(node), node) : undefined;
    if (!source) continue;
    for (const [property, role] of Object.entries(roleOf)) {
      const values = node.props[property] ?? []; const children = childNodes(node, property, nodesByPage.get(node.page) ?? []);
      for (const value of values) {
        const target = targetFor(value, node, role!, byId, entities); edges.push({ from: source.key, to: target, role: role!, property, sourcePage: node.page, declaration: node.decl, nodePath: node.path, rawValue: value }); unresolved(pages, node, value, diagnostics, target.slice(3), byId.has(target.slice(3)));
      }
      for (const child of children) { const target = entityFor(entities, child.id ? entityKey(child) : locationKey(child), child, [role!]).key; edges.push({ from: source.key, to: target, role: role!, property, sourcePage: node.page, declaration: node.decl, nodePath: child.path, rawValue: child.id ?? child.name ?? '' }); }
    }
  }
  const roleIndex = new Map<string, Set<Role>>();
  for (const edge of edges) {
    const key = `${edge.from}|${edge.to}`; const prior = roleIndex.get(key) ?? new Set<Role>();
    if (prior.size && !prior.has(edge.role)) diagnostic(diagnostics, { code: 'role-overlap', severity: 'info', sourcePage: edge.sourcePage, declaration: edge.declaration, nodePath: edge.nodePath, entityKey: edge.from, target: edge.to });
    prior.add(edge.role); roleIndex.set(key, prior);
  }
  cycles(edges, diagnostics);
  return { entities: [...entities.values()].sort((a, b) => a.key.localeCompare(b.key)), edges, diagnostics };
};
