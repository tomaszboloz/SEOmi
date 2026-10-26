import { parseNextLinkHeader } from './release-ci-gate-inventory.mjs';

const parameters = resource => resource === 'analyses'
  ? 'ref=refs%2Fheads%2Fmain&sort=created&direction=desc&per_page=100'
  : 'ref=refs%2Fheads%2Fmain&state=open&per_page=100';

const validateNext = (header, expected) => {
  const raw = parseNextLinkHeader(header);
  const count = typeof header === 'string' ? (header.match(/\brel\s*=\s*["']?next(?:["'\s;]|$)/gi) ?? []).length : 0;
  if (!raw && count === 0) return false;
  if (!raw || count !== 1) throw new Error('Invalid or ambiguous CodeQL pagination metadata');
  const next = new URL(raw, expected);
  const wanted = new URL(expected);
  const keys = [...wanted.searchParams.keys()];
  if (next.origin !== wanted.origin || next.pathname !== wanted.pathname || next.username || next.password || next.hash
    || [...next.searchParams.keys()].length !== keys.length
    || keys.some(key => next.searchParams.getAll(key).length !== 1 || next.searchParams.get(key) !== wanted.searchParams.get(key))) {
    throw new Error('Untrusted CodeQL pagination scope or next page');
  }
  return true;
};

export const readMainCodeqlPages = async ({ request, baseUrl, resource }) => {
  if (!['analyses', 'alerts'].includes(resource)) throw new Error('Invalid CodeQL inventory resource');
  const label = resource === 'analyses' ? 'analysis' : 'alert';
  const key = resource === 'analyses' ? 'id' : 'number';
  const query = parameters(resource);
  const all = [];
  const seen = new Set();
  for (let page = 1; ; page += 1) {
    if (page > 100) throw new Error(`CodeQL ${label} pagination exceeded its bound`);
    const path = `code-scanning/${resource}?${query}&page=${page}`;
    const { data, link } = await request(path);
    if (!Array.isArray(data) || data.length > 100) throw new Error(`Invalid CodeQL ${label} list`);
    for (const entry of data) {
      if (!Number.isSafeInteger(entry?.[key]) || entry[key] < 1 || seen.has(entry[key])) {
        throw new Error(`Invalid or duplicate CodeQL ${label} page`);
      }
      seen.add(entry[key]);
      all.push(entry);
    }
    const next = `${baseUrl}/code-scanning/${resource}?${query}&page=${page + 1}`;
    if (!validateNext(link, next) && data.length < 100) break;
  }
  return all;
};
