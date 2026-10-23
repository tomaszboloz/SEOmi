import { describe, expect, it } from 'vitest';
import { buildDeploymentBundle } from '@/services/deployArtifacts/bundle';
import { buildZip } from '@/services/deployArtifacts/zip';
import { validateRules } from '@/services/deployArtifacts/rules';
import { rulesFromQuarantine } from '@/services/deployArtifacts/fromBus';

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

  it('keeps quarantine entries without a redirect target out of generated rules', () => {
    expect(rulesFromQuarantine([
      { url: absolute('gone'), reason: 'remove', quarantined: true, source: 'site-focus' },
      { url: absolute('missing-target'), reason: 'redirect', quarantined: true, source: 'topical-authority' },
    ])).toEqual([{ from: absolute('gone'), to: null, status: 410 }]);
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
});
