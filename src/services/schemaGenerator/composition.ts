import type { TrustJsonLd } from '@/services/eeatTrust/jsonLd';

export interface SchemaDiffEntry { id: string; property: string; value: unknown; source: 'observed' | 'generated' | 'trust' }
export interface SchemaConflict { id: string; property: string; existing: unknown; incoming: unknown; source: 'generated' | 'trust' }
export interface SchemaCompositionInput {
  observed?: Record<string, unknown>;
  generated?: Record<string, unknown>;
  trust?: TrustJsonLd | Record<string, unknown>;
}
export interface SchemaComposition {
  schema: Record<string, unknown>;
  text: string;
  script: string;
  added: SchemaDiffEntry[];
  conflicts: SchemaConflict[];
  warnings: string[];
}

type Node = Record<string, unknown>;
const nodesOf = (value: Record<string, unknown> | undefined): Node[] => {
  const graph = value?.['@graph'];
  if (Array.isArray(graph)) return graph.filter((item): item is Node => Boolean(item && typeof item === 'object'));
  return value && typeof value === 'object' ? [value] : [];
};
const idOf = (node: Node): string | undefined => typeof node['@id'] === 'string' && node['@id'].trim() ? node['@id'].trim() : undefined;
const comparable = (value: unknown): unknown => Array.isArray(value) && value.length === 1 ? comparable(value[0]) : value;
const equal = (left: unknown, right: unknown): boolean => JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
const merge = (target: Node, incoming: Node, id: string, source: 'generated' | 'trust', added: SchemaDiffEntry[], conflicts: SchemaConflict[]): void => {
  for (const [property, value] of Object.entries(incoming)) {
    if (property === '@id') continue;
    if (value === undefined) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (target[property] === undefined) { target[property] = value; added.push({ id, property, value, source }); continue; }
    if (!equal(target[property], value)) conflicts.push({ id, property, existing: target[property], incoming: value, source });
  }
};

/** Merge observed/generated/trust graphs while retaining existing IDs and never overwriting facts silently. */
export const composeSchemaGraph = (input: SchemaCompositionInput): SchemaComposition => {
  const added: SchemaDiffEntry[] = [];
  const conflicts: SchemaConflict[] = [];
  const warnings: string[] = [];
  const graph: Node[] = [];
  const byId = new Map<string, Node>();
  const add = (node: Node, source: 'observed' | 'generated' | 'trust'): void => {
    const id = idOf(node);
    if (!id) { graph.push({ ...node }); return; }
    const existing = byId.get(id);
    if (!existing) { const copy = { ...node }; graph.push(copy); byId.set(id, copy); return; }
    merge(existing, node, id, source === 'observed' ? 'generated' : source, added, conflicts);
  };
  nodesOf(input.observed).forEach((node) => add(node, 'observed'));
  nodesOf(input.generated).forEach((node) => add(node, 'generated'));
  const trustGraph = input.trust && 'graph' in input.trust && input.trust.graph && typeof input.trust.graph === 'object'
    ? input.trust.graph as Record<string, unknown> : input.trust as Record<string, unknown> | undefined;
  nodesOf(trustGraph).forEach((node) => add(node, 'trust'));
  if (!graph.length) warnings.push('empty-graph');
  graph.forEach((node) => {
    if (typeof node['@type'] !== 'string' && !Array.isArray(node['@type'])) warnings.push(`missing-type:${idOf(node) ?? 'inline'}`);
  });
  const schema: Record<string, unknown> = { '@context': 'https://schema.org', '@graph': graph };
  const text = serializeJsonLd(schema);
  return { schema, text, script: `<script type="application/ld+json">\n${text}\n</script>`, added, conflicts, warnings };
};

/**
 * JSON-LD is rendered as data. Every `<` becomes `<`: escaping only `</script` still lets `<!--<script`
 * switch the HTML parser to the double-escaped state, where the closing tag no longer ends the element.
 * Line separators are escaped for JavaScript consumers. The parsed JSON value is unchanged.
 */
export const serializeJsonLd = (schema: Record<string, unknown>): string => JSON.stringify(schema, null, 2)
  .replace(/</gu, '\\u003c').replace(/\u2028/gu, '\\u2028').replace(/\u2029/gu, '\\u2029');
