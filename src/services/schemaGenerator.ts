export type { SchemaPageSource, SchemaArticleType, SchemaGraphInput, GeneratedSchemaGraph } from "./schemaGenerator/contracts";
export { SCHEMA_ARTICLE_TYPES } from "./schemaGenerator/contracts";
export { generateSchemaGraph } from "./schemaGenerator/graph";
export { composeSchemaGraph, serializeJsonLd, type SchemaComposition, type SchemaCompositionInput, type SchemaConflict, type SchemaDiffEntry } from "./schemaGenerator/composition";
