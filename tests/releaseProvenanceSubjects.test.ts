import { expect, it } from 'vitest';
import { resolveProvenanceArtifacts } from '../scripts/release-provenance-subjects.mjs';

it.each([null, {}, 'invalid'])('rejects a malformed asset inventory %j', assets => {
  expect(() => resolveProvenanceArtifacts(assets, '0.4.41')).toThrow('Release assets must be an array');
});

it.each(['../escape', 'v0.4.41', '0.4.41/path'])('rejects an unsafe version %s', version => {
  expect(() => resolveProvenanceArtifacts([], version)).toThrow();
});

it('does not substitute archives from a different release version', () => {
  const assets = ['SEOmi_0.4.40_aarch64.app.tar.gz', 'SEOmi_0.4.40_x64.app.tar.gz'].map(name => ({ name }));
  expect(() => resolveProvenanceArtifacts(assets, '0.4.41')).toThrow('Missing release asset');
});
