export interface Scope { protocol: string; host: string; port: string; origin: string }

export const scopeOf = (value?: string | null): Scope | null => {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return { protocol: url.protocol, host, port: url.port, origin: `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}` };
  } catch { return null; }
};

const keyOf = (value: string, scope: Scope): string | null => {
  const found = scopeOf(value);
  if (!found || found.origin !== scope.origin) return null;
  const url = new URL(value);
  const path = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '') || '/';
  return `${scope.origin}${path}${url.search}`;
};

/** Key = origin + path + query. Other protocol/host/port gives null; the alias map resolves canonical/redirect targets. */
export const urlKey = (value: string, base: string, scope: Scope, aliases: Readonly<Record<string, string>> = {}): string | null => {
  let absolute: string;
  try { absolute = new URL(value, base).href; } catch { return null; }
  const direct = keyOf(absolute, scope);
  const target = direct ? aliases[direct] : undefined;
  return target ? keyOf(target, scope) ?? direct : direct;
};
