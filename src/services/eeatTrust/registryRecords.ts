import type { ProfileEvidence } from './types';

type RecordValue = Record<string, unknown>;
export interface RegistryRecord { id: string; names: string[]; urls: string[] }
const object = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const field = (value: unknown): string | undefined => object(value) && typeof value.value === 'string' ? value.value : undefined;
const values = (value: unknown): unknown[] => object(value) ? Object.values(value).slice(0, 64) : [];
const list = (value: unknown): unknown[] => Array.isArray(value) ? value.slice(0, 64) : [];

const orcidRecord = (data: RecordValue): RegistryRecord | undefined => {
  const identifier = data['orcid-identifier'];
  if (!object(identifier)) return undefined;
  const id = typeof identifier.path === 'string' ? identifier.path
    : typeof identifier.uri === 'string' ? identifier.uri.match(/\/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])\/?$/)?.[1] : undefined;
  if (!id) return undefined;
  const person = data.person;
  const name = object(person) ? person.name : undefined;
  const names: string[] = [];
  if (object(name)) {
    const fullName = [field(name['given-names']), field(name['family-name'])].filter(Boolean).join(' ');
    if (fullName) names.push(fullName);
    const credit = field(name['credit-name']);
    if (credit) names.push(credit);
  }
  if (object(person)) {
    const aliases = person['other-names'];
    if (object(aliases)) list(aliases['other-name']).forEach((item) => {
      if (object(item) && typeof item.content === 'string') names.push(item.content);
    });
  }
  const links = object(person) ? person['researcher-urls'] : undefined;
  const urls = object(links) ? list(links['researcher-url']).flatMap((item) => {
    const value = object(item) ? field(item.url) : undefined;
    return value ? [value] : [];
  }) : [];
  return { id, names, urls };
};

const wikidataRecord = (data: RecordValue, expectedId?: string): RegistryRecord | undefined => {
  const entities = data.entities;
  if (!object(entities)) return undefined;
  const fallback = values(entities).filter(object);
  const entity = expectedId && object(entities[expectedId]) ? entities[expectedId] : fallback.length === 1 ? fallback[0] : undefined;
  if (!object(entity) || typeof entity.id !== 'string') return undefined;
  const names = [...values(entity.labels), ...values(entity.aliases).flatMap(list)]
    .flatMap((item) => { const value = field(item); return value ? [value] : []; });
  const claims = entity.claims;
  const urls = object(claims) ? list(claims.P856).flatMap((claim) => {
    const snak = object(claim) ? claim.mainsnak : undefined;
    const value = object(snak) ? field(snak.datavalue) : undefined;
    return value ? [value] : [];
  }) : [];
  return { id: entity.id, names, urls };
};

/** Reads only official registry JSON shapes; HTML text and arbitrary name fields are not identity evidence. */
export const readRegistryRecord = (profile: ProfileEvidence, body: string): RegistryRecord | undefined => {
  if (body.length > 512_000) return undefined;
  try {
    const data: unknown = JSON.parse(body);
    if (!object(data)) return undefined;
    return profile.kind === 'orcid' ? orcidRecord(data) : profile.kind === 'wikidata' ? wikidataRecord(data, profile.id) : undefined;
  } catch { return undefined; }
};
