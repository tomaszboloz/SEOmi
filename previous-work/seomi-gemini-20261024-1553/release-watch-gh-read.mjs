import { execFileSync } from 'node:child_process';
export const gh = args => execFileSync('gh', args, { encoding: 'utf8', env: { ...process.env, GH_DEBUG: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
export const json = args => JSON.parse(gh(args));
export const read = async (input, init) => {
  const url = new URL(String(input));
  if (url.origin !== 'https://api.github.com' || !url.pathname.startsWith('/repos/tomaszboloz/SEOmi/')) throw new Error('Untrusted coordinator API endpoint');
  if (init?.method && init.method !== 'GET') throw new Error('Coordinator evidence transport is read-only');
  let raw;
  try { raw = gh(['api', '--include', url.pathname.slice(1) + url.search]); }
  catch (error) {
    if (!String(error.stdout ?? '').startsWith('HTTP/')) throw error;
    raw = String(error.stdout);
  }
  const split = raw.search(/\r?\n\r?\n/);
  if (split < 0) throw new Error('Missing GitHub response headers');
  const header = raw.slice(0, split);
  const body = raw.slice(split).replace(/^\r?\n\r?\n/, '');
  const status = Number(header.match(/^HTTP\/[^ ]+ (\d+)/)?.[1]);
  const link = header.split(/\r?\n/).find(line => /^link:/i.test(line))?.replace(/^link:\s*/i, '');
  return new Response(body, { status, headers: link ? { Link: link } : {} });
};
export const api = async suffix => {
  const response = await read(`https://api.github.com/repos/tomaszboloz/SEOmi/${suffix}`);
  if (!response.ok) throw new Error(`GitHub evidence HTTP ${response.status}`);
  return response.json();
};
