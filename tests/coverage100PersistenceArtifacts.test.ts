import { describe, expect, it } from 'vitest';
import { buildDeploymentBundle } from '@/services/deployArtifacts/bundle';
import { buildZip } from '@/services/deployArtifacts/zip';
import { ruleKey, rulePath, validateRules } from '@/services/deployArtifacts/rules';
import { rulesFromQuarantine } from '@/services/deployArtifacts/fromBus';
import { buildHtaccess } from '@/services/deployArtifacts/apache';
import { buildNginx } from '@/services/deployArtifacts/nginx';
import { buildCloudflareCsv } from '@/services/deployArtifacts/cloudflare';
import { buildWpRedirectionCsv, buildWpRedirectionJson } from '@/services/deployArtifacts/wpRedirection';
import { csvField } from '@/services/deployArtifacts/csv';

const absolute = (name: string) => `https://site.test/${name}`;

describe('deployment artifact recovery boundaries', () => {
  it('caps an excessively long redirect chain while reporting flattening', () => {
    const input = Array.from({ length: 23 }, (_, index) => ({
      from: absolute(`p${index}`), to: absolute(`p${index + 1}`), status: 301 as const,
    }));
    const result = validateRules(input);
    expect(result.rules).toHaveLength(23);
    expect(result.rules[0].to).toBe(absolute('p21'));
    expect(result.issues.filter((issue) => issue.kind === 'chain-flattened')).toHaveLength(22);
  });

  it('keeps quarantine entries without a redirect target out of generated rules and maps targets', () => {
    expect(rulesFromQuarantine([
      { url: absolute('gone'), reason: 'remove', quarantined: true, source: 'site-focus' },
      { url: absolute('missing-target'), reason: 'redirect', quarantined: true, source: 'topical-authority' },
      { url: absolute('has-target'), reason: 'redirect', target: absolute('target'), quarantined: true, source: 'topical-authority' },
    ])).toEqual([
      { from: absolute('gone'), to: null, status: 410 },
      { from: absolute('has-target'), to: absolute('target'), status: 301 },
    ]);
  });

  it('renders an empty bundle and a UTF-8 zip without inventing rules', () => {
    const bundle = buildDeploymentBundle([]);
    expect(bundle.ruleCount).toBe(0);
    expect(bundle.issues).toEqual([]);
    expect(bundle.files).toHaveLength(5);
    const zip = buildZip([{ name: 'łódź.txt', content: 'zażółć gęślą jaźń' }]);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(zip)).toContain('łódź.txt');
  });

  it('builds Apache, Nginx and Cloudflare artifacts handling 410, queries and formulas', () => {
    const rules = [
      { from: absolute('old$'), to: absolute('new$1'), status: 301 as const },
      { from: absolute('gone'), to: null, status: 410 as const },
      { from: 'https://site.test/query?a=1', to: absolute('target'), status: 301 as const },
    ];
    const htaccess = buildHtaccess(rules);
    expect(htaccess.content).toContain('RedirectMatch 301 "^/old\\\\$$" "https://site.test/new%241"');
    expect(htaccess.content).toContain('RedirectMatch 410 "^/gone$"');
    expect(htaccess.skipped).toEqual([{ kind: 'query-unsupported', from: 'https://site.test/query?a=1' }]);

    const nginx = buildNginx(rules);
    expect(nginx.content).toContain('location = "/old$" { return 301 "https://site.test/new%241"; }');
    expect(nginx.content).toContain('location = "/gone" { return 410; }');
    expect(nginx.skipped).toEqual([{ kind: 'query-unsupported', from: 'https://site.test/query?a=1' }]);

    const cf = buildCloudflareCsv(rules);
    expect(cf.content).toContain('site.test/old$,https://site.test/new$1,301,false,false,false,false');
    expect(cf.skipped).toEqual([{ kind: 'gone-unsupported', from: absolute('gone') }]);

    expect(buildWpRedirectionCsv(rules).content).toContain('/gone,,false,410');
    expect(buildWpRedirectionJson(rules).content).toContain('"action_type": "error"');
  });

  it('covers formula neutralization, rule validation loops and dead targets', () => {
    expect(csvField('=1+2')).toBe("'=1+2");
    expect(csvField('+1')).toBe("'+1");
    expect(csvField('https://site.test/=1')).toBe('https://site.test/=1');
    expect(csvField('a,"b",c')).toBe('"a,""b"",c"');
    expect(ruleKey('not-url')).toBe('');
    expect(ruleKey('ftp://site.test/')).toBe('');
    expect(rulePath('https://site.test/%E0%A4%A')).toBe('/%E0%A4%A');

    const loopResult = validateRules([
      { from: absolute('loop'), to: absolute('loop'), status: 301 },
      { from: absolute('a'), to: absolute('b'), status: 301 },
      { from: absolute('b'), to: absolute('a'), status: 301 },
      { from: absolute('dead'), to: absolute('gone'), status: 301 },
      { from: absolute('gone'), to: null, status: 410 },
      { from: absolute('invalid'), to: null, status: 301 },
      { from: absolute('unsupported-status'), to: absolute('x'), status: 302 as never },
    ]);
    expect(loopResult.issues.map((i) => i.kind)).toEqual(
      expect.arrayContaining(['loop', 'dead-target', 'invalid']),
    );
  });
});
