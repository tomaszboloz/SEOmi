import type { CrawledPageSummary, CrawledSchemaReference } from '@/types';

/** JSON-LD nodes rebuilt from the crawler's bounded schema references (grouped by declaration and node path). */
export interface SchemaNode {
  page: string;
  decl: number;
  path: string;
  id?: string;
  canonicalId?: string;
  types: string[];
  name?: string;
  props: Record<string, string[]>;
}

type Ref = CrawledSchemaReference & { node_path?: string | null };

const ARTICLE_TYPE = /WebPage|Article|BlogPosting|MedicalWebPage|ScholarlyArticle|Report|HowTo|Review|NewsMedia/i;
const ORGANIZATION_TYPE = /Organization|LocalBusiness|Corporation|Hospital|Clinic|Physician|Pharmacy|Store/i;

const push = (target: string[], value: string): void => { if (!target.includes(value)) target.push(value); };

/** Resolve an @id in the context of the declaration page; raw id remains available on SchemaNode. */
export const canonicalId = (value: string | undefined, page: string): string | undefined => {
  if (!value?.trim()) return undefined;
  try { return new URL(value, page).toString(); } catch { return value.trim(); }
};

export const nodeIdentity = (node: SchemaNode): string => node.canonicalId ?? canonicalId(node.id, node.page) ?? `node:${node.page}|${node.decl}|${node.path}`;
export const isCompleteDefinition = (node: SchemaNode): boolean => Boolean(node.types.length || node.name || Object.keys(node.props).length);

/** Every JSON-LD node of a page; references without a node path share the declaration's root node. */
export const nodesOf = (page: CrawledPageSummary): SchemaNode[] => {
  const nodes = new Map<string, SchemaNode>();
  const url = page.final_url || page.url;
  for (const ref of (page.schema_references ?? []) as Ref[]) {
    if (ref.format !== 'JSON-LD') continue;
    const path = ref.node_path ?? '$';
    const key = `${ref.declaration_index}|${path}`;
    const node = nodes.get(key) ?? { page: url, decl: ref.declaration_index, path, types: [], props: {} };
    nodes.set(key, node);
    if (ref.property === '@id') { node.id = ref.value; node.canonicalId = canonicalId(ref.value, url); }
    else if (ref.property === '@type') push(node.types, ref.value);
    else if (ref.property === 'name') node.name = ref.value;
    else push(node.props[ref.property] ??= [], ref.value);
  }
  return [...nodes.values()];
};

export const isArticleNode = (node: SchemaNode): boolean => node.types.some((type) => ARTICLE_TYPE.test(type));
export const isOrganizationNode = (node: SchemaNode): boolean => node.types.some((type) => ORGANIZATION_TYPE.test(type));
export const isPersonNode = (node: SchemaNode): boolean => node.types.includes('Person');

/** Nodes nested under `node` through `property` (e.g. an inline author object). */
export const childNodes = (node: SchemaNode, property: string, siblings: SchemaNode[]): SchemaNode[] => {
  const prefix = `${node.path}.${property}`;
  return siblings.filter((other) => other.decl === node.decl && other.path.startsWith(prefix)
    && (other.path.length === prefix.length || other.path[prefix.length] === '['));
};

/** Same entity declared on several pages is merged by its @id. */
export const buildRegistry = (nodes: SchemaNode[]): Map<string, SchemaNode> => {
  const registry = new Map<string, SchemaNode>();
  for (const node of nodes) {
    if (!node.id) continue;
    const key = nodeIdentity(node);
    const merged = registry.get(key) ?? { ...node, types: [], props: {} };
    node.types.forEach((type) => push(merged.types, type));
    merged.name ??= node.name;
    for (const [property, values] of Object.entries(node.props)) values.forEach((value) => push(merged.props[property] ??= [], value));
    registry.set(key, merged);
  }
  return registry;
};
