import { describe, expect, it } from 'vitest';
import { buildHtaccess } from '@/services/deployArtifacts/apache';
import { buildNginx } from '@/services/deployArtifacts/nginx';
import { buildCloudflareCsv } from '@/services/deployArtifacts/cloudflare';
import { buildWpRedirectionCsv, buildWpRedirectionJson } from '@/services/deployArtifacts/wpRedirection';
import { csvField } from '@/services/deployArtifacts/csv';
import type { RedirectRule } from '@/services/deployArtifacts/types';

const rules: RedirectRule[] = [
  { from: 'https://a.test/old', to: 'https://a.test/new', status: 301 },
  { from: 'https://a.test/gone.html', to: null, status: 410 },
  { from: 'https://a.test/a b/(x)$1', to: 'https://a.test/t?q=1&r=$2', status: 301 },
  { from: 'https://a.test/p?id=3', to: 'https://a.test/p3', status: 301 },
];

describe('artifact formats', () => {
  it('htaccess: anchored escaped patterns, 410, query skipped', () => {
    const file = buildHtaccess(rules);
    expect(file.content.split('\n')).toEqual([
      '# SEOmi redirects (mod_alias)',
      'RedirectMatch 301 "^/old$" "https://a.test/new"',
      String.raw`RedirectMatch 410 "^/gone\\.html$"`,
      String.raw`RedirectMatch 301 "^/a b/\\(x\\)\\$1$" "https://a.test/t?q=1&r=%242"`,
      '',
    ]);
    expect(file.skipped).toEqual([{ kind: 'query-unsupported', from: 'https://a.test/p?id=3' }]);
  });

  it('nginx: exact locations, dollar encoded', () => {
    const file = buildNginx(rules);
    expect(file.content).toMatchInlineSnapshot(`
      "# SEOmi redirects (include inside server { })
      location = "/old" { return 301 "https://a.test/new"; }
      location = "/gone.html" { return 410; }
      location = "/a b/(x)$1" { return 301 "https://a.test/t?q=1&r=%242"; }
      "
    `);
    expect(file.skipped).toHaveLength(1);
  });

  it('cloudflare: no scheme in source, 410 reported', () => {
    const file = buildCloudflareCsv(rules);
    expect(file.content.split('\r\n')[0]).toBe('a.test/old,https://a.test/new,301,false,false,false,false');
    expect(file.skipped).toEqual([{ kind: 'gone-unsupported', from: 'https://a.test/gone.html' }]);
  });

  it('wordpress redirection csv and json', () => {
    expect(buildWpRedirectionCsv(rules).content.split('\r\n').slice(0, 3)).toEqual(['source,target,regex,code', '/old,https://a.test/new,false,301', '/gone.html,,false,410']);
    const json = JSON.parse(buildWpRedirectionJson(rules).content);
    expect(json.redirects[1]).toMatchObject({ url: '/gone.html', action_type: 'error', action_code: 410, action_data: '' });
    expect(json.redirects[0]).toMatchObject({ action_type: 'url', action_data: { url: 'https://a.test/new' } });
  });

  it('csv quoting and formula neutralisation', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "x"')).toBe('"say ""x"""');
    expect(csvField('=SUM(1)')).toBe("'=SUM(1)");
    expect(csvField('/x-y')).toBe('/x-y');
    expect(csvField(301)).toBe('301');
  });

  it('path with undecodable percent sequence falls back to raw path', () => {
    const file = buildNginx([{ from: 'https://a.test/%E0%A4%A', to: 'https://a.test/x', status: 301 }]);
    expect(file.content).toContain('location =');
  });
});
