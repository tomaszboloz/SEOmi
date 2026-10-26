import { createHash } from 'node:crypto';
import { statSync, existsSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { isPathWithin } from './release-artifact-paths.mjs';
import { readReleaseFile, writeReleaseFileAtomically } from './release-atomic-file.mjs';
import { validateGithubApiBase, validateRepository, validateReleaseId } from './release-input-validation.mjs';

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
  apiUrl = validateGithubApiBase(apiUrl); repository = validateRepository(repository);
  const assetId = validateReleaseId(asset?.id);
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
    if (!isPathWithin(realDir, realFile)) throw new Error(`Path escape detected: ${name}`);
    const cached = readReleaseFile(p, realDir);
    if (asset.size !== undefined && cached.length !== asset.size) throw new Error(`Cache tamper detected for ${name}: local size mismatch`);
    if (expDigest) {
      const localHash = createHash('sha256').update(cached).digest('hex');
      if (localHash !== expDigest) throw new Error(`Cache tamper detected for ${name}: local hash ${localHash} !== ${expDigest}`);
      return { sha256: localHash, size: cached.length };
    }
  }

  const aRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${assetId}`, { headers: { ...headers, Accept: 'application/octet-stream' } });
  if (!aRes.ok) throw new Error(`Download failed for ${name}: HTTP ${aRes.status}`);
  const buf = Buffer.from(await aRes.arrayBuffer());
  if (asset.size !== undefined && buf.length !== asset.size) throw new Error(`Downloaded asset size mismatch for ${name}`);
  const dlHash = createHash('sha256').update(buf).digest('hex');
  if (expDigest && dlHash !== expDigest) throw new Error(`Downloaded asset digest mismatch for ${name}: ${dlHash} !== ${expDigest}`);
  writeReleaseFileAtomically(p, buf);
  return { sha256: dlHash, size: buf.length };
};

export const uploadReleaseAsset = async ({
  uploadUrl = 'https://uploads.github.com', apiUrl = 'https://api.github.com',
  repository, releaseId, token, name, content, contentType = 'application/octet-stream',
  fetchImpl = fetch, existingAssets = [],
}) => {
  if (!PROVENANCE_METADATA_NAMES.has(name)) throw new Error(`Managed metadata asset disallowed: ${name}`);
  apiUrl = validateGithubApiBase(apiUrl); uploadUrl = validateGithubApiBase(uploadUrl, true);
  repository = validateRepository(repository); releaseId = validateReleaseId(releaseId);
  const headers = { Authorization: `Bearer ${token}` };
  const contentBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const existing = (existingAssets ?? []).find((a) => a.name === name);
  if (existing) {
    const existingId = validateReleaseId(existing.id);
    if (existing.size === contentBuf.length) {
      const getRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${existingId}`, { headers: { ...headers, Accept: 'application/octet-stream' } });
      if (getRes.ok) {
        const existingBuf = Buffer.from(await getRes.arrayBuffer());
        if (Buffer.compare(existingBuf, contentBuf) === 0) return existing;
      }
    }
    await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${existingId}`, { method: 'DELETE', headers });
  }
  const postUrl = `${uploadUrl}/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
  const res = await fetchImpl(postUrl, { method: 'POST', headers: { ...headers, 'Content-Type': contentType }, body: content });
  if (!res.ok) {
    if (res.status === 422) {
      const relRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/${releaseId}`, { headers });
      if (relRes.ok) {
        const found = ((await relRes.json()).assets ?? []).find((a) => a.name === name);
        if (found) {
          const dlRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${validateReleaseId(found.id)}`, { headers: { ...headers, Accept: 'application/octet-stream' } });
          if (dlRes.ok && Buffer.compare(Buffer.from(await dlRes.arrayBuffer()), contentBuf) === 0) return found;
        }
      }
    }
    throw new Error(`Failed to upload asset ${name}: HTTP ${res.status}`);
  }
  return await res.json();
};
