/** The one JSON-LD node model (#106): graph flattening, @type and @id reading, safe parsing. */
export type JsonLdNode = Record<string, unknown>;

export const isJsonLdNode = (value: unknown): value is JsonLdNode => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Object items of a `@graph` array; empty when there is no array graph. */
export const graphItems = (value: unknown): JsonLdNode[] => {
  const graph = isJsonLdNode(value) ? value['@graph'] : undefined;
  return Array.isArray(graph) ? graph.filter(isJsonLdNode) : [];
};

/** Declared nodes: the `@graph` items, or the value itself when it is a plain node without an array graph. */
export const declaredNodes = (value: unknown): JsonLdNode[] => {
  if (isJsonLdNode(value) && Array.isArray(value['@graph'])) return graphItems(value);
  return isJsonLdNode(value) ? [value] : [];
};

/** The node itself followed by its `@graph` items (rich-result lookup order). */
export const nodeAndGraph = (value: unknown): JsonLdNode[] => (isJsonLdNode(value) ? [value, ...graphItems(value)] : []);

/** `@type` strings of one node; non-string entries are ignored. */
export const nodeTypes = (node: JsonLdNode): string[] => {
  const raw = node['@type'];
  if (typeof raw === 'string') return [raw];
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
};

export const nodeId = (node: JsonLdNode): string | undefined => (typeof node['@id'] === 'string' && node['@id'].trim() ? node['@id'].trim() : undefined);

/** Parses a JSON-LD script body; null when it is not valid JSON. */
export const parseJsonLd = (text: string): unknown => {
  try { return JSON.parse(text); } catch { return null; }
};
