import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const shaA = 'a'.repeat(40);

export function mockRelease(dir: string, {
  ver = '0.4.40', versionedMac = false, draft = true, wrongSha = false, missingDmg = false, invalidSbom = false, noSbom = false,
  tamper = false, equalSizeTamper = false, downloadTamper = false, validCache = false, dupAsset = false,
  failOnUpload = 0, noDigest = false, badDigest = false, existingAssets = null as any, bytesMap = null as any,
} = {}) {
  const files = [versionedMac ? `SEOmi_${ver}_aarch64.app.tar.gz` : 'SEOmi_aarch64.app.tar.gz', versionedMac ? `SEOmi_${ver}_x64.app.tar.gz` : 'SEOmi_x64.app.tar.gz', `SEOmi_${ver}_x64-setup.exe`, `SEOmi_${ver}_x64_en-US.msi`, 'latest.json', `SEOmi_${ver}_aarch64.dmg`, `SEOmi_${ver}_x64.dmg`];
  const targetFiles = missingDmg ? files.filter((f) => !f.endsWith('.dmg')) : files;
  const remoteMap: Map<string, Buffer> = bytesMap ?? new Map(targetFiles.map((n, i) => [n, Buffer.from(`pay-${n}-${i}`)]));
  let nextId = 100, uploadCount = 0; const uploads: string[] = [];
  const assets = existingAssets ?? targetFiles.map((n, i) => {
    const b = remoteMap.get(n)!, d = badDigest && i === 0 ? `sha256:${'0'.repeat(63)}` : (noDigest ? undefined : `sha256:${createHash('sha256').update(b).digest('hex')}`);
    return { id: nextId++, name: n, size: b.length, digest: d };
  });
  if (dupAsset) assets.push({ id: 999, name: assets[0].name, size: assets[0].size, digest: assets[0].digest });
  if (!noSbom) {
    const comp = invalidSbom ? 'invalid' : [{ name: 'dep' }];
    writeFileSync(join(dir, 'sbom-node.json'), JSON.stringify({ bomFormat: 'CycloneDX', components: comp }));
    writeFileSync(join(dir, 'sbom-rust.json'), JSON.stringify({ bomFormat: 'CycloneDX', components: comp }));
  }
  if (tamper) writeFileSync(join(dir, files[0]), 'tampered-stale-different-length');
  if (equalSizeTamper) writeFileSync(join(dir, files[0]), Buffer.alloc(remoteMap.get(files[0])!.length, 90));
  if (validCache) writeFileSync(join(dir, files[0]), remoteMap.get(files[0])!);
  const fetchImpl = async (url: string | URL | Request, opts?: RequestInit) => {
    const u = String(url), m = opts?.method ?? 'GET';
    if (m === 'DELETE') {
      const id = Number(u.split('/').pop()), idx = assets.findIndex((a: any) => a.id === id);
      if (idx >= 0) assets.splice(idx, 1);
      return new Response(null, { status: 204 });
    }
    if (m === 'POST') {
      const name = decodeURIComponent(u.split('name=')[1] ?? ''); uploadCount++;
      if (failOnUpload > 0 && uploadCount === failOnUpload) return new Response('err', { status: 503 });
      if (assets.some((a: any) => a.name === name)) return new Response('{"message":"already_exists"}', { status: 422 });
      const id = nextId++; assets.push({ id, name, size: Number(opts?.body ? String(opts.body).length : 0) });
      remoteMap.set(name, Buffer.from(opts?.body ? String(opts.body) : '')); uploads.push(name);
      return new Response(JSON.stringify({ id, name }), { status: 201 });
    }
    if (u.endsWith('/releases/123')) return new Response(JSON.stringify({ id: 123, tag_name: 'v' + ver, draft, target_commitish: wrongSha ? 'b'.repeat(40) : shaA, assets: [...assets] }));
    const id = Number(u.split('/').pop()), asset = assets.find((a: any) => a.id === id);
    if (!asset) return new Response('missing', { status: 404 });
    const bodyBytes = downloadTamper && asset.name === files[0] ? Buffer.alloc(asset.size, 88) : remoteMap.get(asset.name)!;
    return new Response(new Uint8Array(bodyBytes), { status: 200 });
  };
  return { uploads, fetchImpl, assets, remoteMap };
}
