import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync, existsSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';

export const PROVENANCE_METADATA_NAMES = Object.freeze(
  new Set(['sbom-node.json', 'sbom-rust.json', 'SHA256SUMS.txt', 'release-provenance.json'])
);

export const extractAssetDigest = (asset) => {
  const raw = asset?.digest ?? asset?.sha256;
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^(?:sha256:)?([0-9a-f]{64})$/i);
  return match ? match[1].toLowerCase() : null;
};

export const fetchOrVerifyAsset = async ({
  asset, name, artifactDir, realDir, headers, apiUrl, repository, fetchImpl = fetch,
}) => {
  if (name.includes('..') || isAbsolute(name)) throw new Error(`Path traversal rejected: ${name}`);
  const rawDigest = asset?.digest ?? asset?.sha256;
  let expDigest = null;
  if (rawDigest !== undefined && rawDigest !== null) {
    if (typeof rawDigest !== 'string') throw new Error(`Malformed asset digest for ${name}: expected string`);
    const match = rawDigest.trim().match(/^(?:sha256:)?([0-9a-f]{64})$/i);
    if (!match) throw new Error(`Malformed asset digest for ${name}: ${rawDigest}`);
    expDigest = match[1].toLowerCase();
  }

  const p = `${artifactDir}/${name}`;
  if (existsSync(p)) {
    const realFile = realpathSync(p);
    if (!realFile.startsWith(realDir + '/') && realFile !== realDir) throw new Error(`Path escape detected: ${name}`);
    if (asset.size !== undefined && statSync(p).size !== asset.size) throw new Error(`Cache tamper detected for ${name}: local size mismatch`);
    if (expDigest) {
      const localHash = createHash('sha256').update(readFileSync(p)).digest('hex');
      if (localHash !== expDigest) throw new Error(`Cache tamper detected for ${name}: local hash ${localHash} !== ${expDigest}`);
      return;
    }
  }

  const aRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${asset.id}`, { headers: { ...headers, Accept: 'application/octet-stream' } });
  if (!aRes.ok) throw new Error(`Download failed for ${name}: HTTP ${aRes.status}`);
  const buf = Buffer.from(await aRes.arrayBuffer());
  if (asset.size !== undefined && buf.length !== asset.size) throw new Error(`Downloaded asset size mismatch for ${name}`);
  const dlHash = createHash('sha256').update(buf).digest('hex');
  if (expDigest && dlHash !== expDigest) throw new Error(`Downloaded asset digest mismatch for ${name}: ${dlHash} !== ${expDigest}`);
  writeFileSync(p, buf);
};

export const uploadReleaseAsset = async ({
  uploadUrl = 'https://uploads.github.com', apiUrl = 'https://api.github.com',
  repository, releaseId, token, name, content, contentType = 'application/octet-stream',
  fetchImpl = fetch, existingAssets = [],
}) => {
  if (!PROVENANCE_METADATA_NAMES.has(name)) throw new Error(`Managed metadata asset disallowed: ${name}`);
  const headers = { Authorization: `Bearer ${token}` };
  const contentBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const existing = (existingAssets ?? []).find((a) => a.name === name);
  if (existing) {
    if (existing.size === contentBuf.length) {
      const getRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${existing.id}`, { headers: { ...headers, Accept: 'application/octet-stream' } });
      if (getRes.ok) {
        const existingBuf = Buffer.from(await getRes.arrayBuffer());
        if (Buffer.compare(existingBuf, contentBuf) === 0) return existing;
      }
    }
    await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${existing.id}`, { method: 'DELETE', headers });
  }
  const postUrl = `${uploadUrl}/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
  const res = await fetchImpl(postUrl, { method: 'POST', headers: { ...headers, 'Content-Type': contentType }, body: content });
  if (!res.ok) {
    if (res.status === 422) {
      const relRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/${releaseId}`, { headers });
      if (relRes.ok) {
        const found = ((await relRes.json()).assets ?? []).find((a) => a.name === name);
        if (found) {
          const dlRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${found.id}`, { headers: { ...headers, Accept: 'application/octet-stream' } });
          if (dlRes.ok && Buffer.compare(Buffer.from(await dlRes.arrayBuffer()), contentBuf) === 0) return found;
        }
      }
    }
    throw new Error(`Failed to upload asset ${name}: HTTP ${res.status}`);
  }
  return await res.json();
};
