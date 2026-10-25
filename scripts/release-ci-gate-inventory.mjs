export const parseNextLinkHeader = (linkHeader) => {
  if (!linkHeader || typeof linkHeader !== 'string') return null;
  const entries = linkHeader.split(',');
  for (const entry of entries) {
    const match = entry.match(/<([^>]+)>;[^>]*\brel=["']?next["']?/i);
    if (match) return match[1].trim();
  }
  return null;
};

const getLinkHeader = (res) => {
  if (typeof res?.headers?.get === 'function') {
    return res.headers.get('link') || res.headers.get('Link');
  }
  return res?.headers?.link || res?.headers?.Link || null;
};

export const isTrustedNextUrl = (nextUrl, expectedBase) => {
  if (nextUrl.origin !== expectedBase.origin) return false;
  if (nextUrl.protocol !== expectedBase.protocol) return false;
  const clean = (p) => p.replace(/\/+$/, '');
  return clean(nextUrl.pathname) === clean(expectedBase.pathname);
};

export const listAllReleases = async ({
  apiUrl = 'https://api.github.com',
  repository,
  token,
  headers,
  fetchImpl = fetch,
  maxPages = 100,
}) => {
  if (!repository) throw new Error('repository is required.');
  const defaultHeaders = headers ?? {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const expectedBase = new URL(`${apiUrl}/repos/${repository}/releases`);
  let currentUrl = `${apiUrl}/repos/${repository}/releases?per_page=50`;
  const allReleases = [];
  const visited = new Set();

  while (currentUrl) {
    if (visited.has(currentUrl)) {
      throw new Error(`Cyclic pagination detected: ${currentUrl}`);
    }
    if (visited.size >= maxPages) {
      throw new Error(`Exceeded maximum pagination limit of ${maxPages} pages.`);
    }
    visited.add(currentUrl);

    const res = await fetchImpl(currentUrl, { headers: defaultHeaders });
    if (!res.ok) {
      throw new Error(`Failed to list releases from ${currentUrl}: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      const typeDesc = data === null ? 'null' : typeof data;
      throw new Error(`Invalid releases inventory response from ${currentUrl}: expected Array, got ${typeDesc}`);
    }
    allReleases.push(...data);

    const rawNext = parseNextLinkHeader(getLinkHeader(res));
    if (!rawNext) break;

    const nextUrl = new URL(rawNext, currentUrl);
    if (!isTrustedNextUrl(nextUrl, expectedBase)) {
      throw new Error(`Untrusted pagination next URL: ${nextUrl.href}`);
    }
    currentUrl = nextUrl.href;
  }

  return allReleases;
};
