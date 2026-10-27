import { validateReleaseAssetsAndPlatforms } from './release-ci-gate-assets.mjs';
import { listAllReleases } from './release-ci-gate-inventory.mjs';
import { validateGithubApiBase, validateRepository, validateReleaseId, validateReleaseTag, validateReleaseVersion } from './release-input-validation.mjs';

const resolveRefCommitSha = async (refData, headers, apiUrl, repository, fetchImpl) => {
  let commitSha = refData?.object?.sha;
  if (refData?.object?.type === 'tag') {
    const tagRes = await fetchImpl(`${apiUrl}/repos/${repository}/git/tags/${commitSha}`, { headers });
    if (!tagRes.ok) throw new Error(`Failed to resolve annotated tag ${commitSha}: HTTP ${tagRes.status}`);
    commitSha = (await tagRes.json())?.object?.sha;
  }
  return commitSha;
};

const verifyOrCreateTagRef = async ({ apiUrl, repository, tag, expectedSha, headers, fetchImpl }) => {
  const refRes = await fetchImpl(`${apiUrl}/repos/${repository}/git/ref/tags/${tag}`, { headers });
  if (refRes.status === 200) {
    const refData = await refRes.json();
    const resolvedSha = await resolveRefCommitSha(refData, headers, apiUrl, repository, fetchImpl);
    if (resolvedSha !== expectedSha) {
      throw new Error(`Release tag ${tag} points to ${resolvedSha}, expected ${expectedSha}.`);
    }
    return { created: false, sha: resolvedSha };
  }
  if (refRes.status === 404) {
    const createRes = await fetchImpl(`${apiUrl}/repos/${repository}/git/refs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: expectedSha }),
    });
    if (!createRes.ok) {
      throw new Error(`Failed to create git ref for tag ${tag} on commit ${expectedSha}: HTTP ${createRes.status}`);
    }
    return { created: true, sha: expectedSha };
  }
  throw new Error(`Failed to check git ref for tag ${tag}: HTTP ${refRes.status}`);
};

const verifyPlatformSignatures = async (release, latestJsonContent, headers, apiUrl, repository, fetchImpl) => {
  const parsed = typeof latestJsonContent === 'string' ? JSON.parse(latestJsonContent) : latestJsonContent;
  const platforms = parsed?.platforms ?? {};
  for (const [p, entry] of Object.entries(platforms)) {
    if (!entry?.url || !entry?.signature) continue;
    const fileName = decodeURIComponent(new URL(entry.url).pathname.split('/').pop() ?? '');
    const sigAsset = (release.assets ?? []).find((a) => a.name === `${fileName}.sig`);
    if (!sigAsset) throw new Error(`Platform ${p} missing paired signature asset ${fileName}.sig`);
    const sigRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${validateReleaseId(sigAsset.id)}`, {
      headers: { ...headers, Accept: 'application/octet-stream' },
    });
    if (!sigRes.ok) throw new Error(`Failed to download signature asset ${sigAsset.name}: HTTP ${sigRes.status}`);
    const actualSig = (await sigRes.text()).trim();
    if (actualSig !== entry.signature.trim()) {
      throw new Error(`Platform ${p} manifest signature does not match paired signature bytes in ${sigAsset.name}`);
    }
  }
};

export const createOrGetDraftRelease = async ({
  apiUrl = 'https://api.github.com', repository, tag, commitSha,
  candidateVersion, name, body, token, fetchImpl = fetch,
}) => {
  if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
  apiUrl = validateGithubApiBase(apiUrl); repository = validateRepository(repository); tag = validateReleaseTag(tag);
  const expectedVer = candidateVersion ? validateReleaseVersion(candidateVersion.replace(/^v/, '')) : null;
  if (expectedVer && tag !== `v${expectedVer}`) {
    throw new Error(`Release tag ${tag} does not match local package version v${expectedVer}.`);
  }
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const releases = await listAllReleases({ apiUrl, repository, token, headers, fetchImpl });
  const matching = releases.filter((r) => r.tag_name === tag && r.draft);
  if (matching.length > 1) {
    throw new Error(`Conflicting duplicate draft releases found for tag ${tag}: [${matching.map((d) => d.id).join(', ')}]`);
  }
  if (matching.length === 1) {
    if (matching[0].target_commitish !== commitSha) {
      throw new Error(`Existing draft release ${matching[0].id} points to ${matching[0].target_commitish}, expected ${commitSha}.`);
    }
    return validateReleaseId(matching[0].id);
  }
  const createRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_name: tag, target_commitish: commitSha, name: name ?? `SEOmi ${tag}`, body: body ?? '', draft: true, prerelease: false }),
  });
  if (!createRes.ok) throw new Error(`Failed to create draft release: HTTP ${createRes.status}`);
  return validateReleaseId((await createRes.json()).id);
};

export const verifyAndPublishDraftRelease = async ({
  apiUrl = 'https://api.github.com', repository, releaseId, expectedSha,
  candidateVersion, token, fetchImpl = fetch,
}) => {
  if (!repository || !token || !releaseId || !expectedSha || !candidateVersion) {
    throw new Error('repository, token, releaseId, expectedSha and candidateVersion are required.');
  }
  apiUrl = validateGithubApiBase(apiUrl); repository = validateRepository(repository); releaseId = validateReleaseId(releaseId);
  const expectedTag = `v${validateReleaseVersion(candidateVersion.replace(/^v/, ''))}`;
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const getRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/${releaseId}`, { headers });
  if (!getRes.ok) throw new Error(`Failed to fetch release ${releaseId}: HTTP ${getRes.status}`);
  const release = await getRes.json();
  if (!release.draft) throw new Error(`Release ${releaseId} is not a draft.`);
  if (release.target_commitish !== expectedSha) {
    throw new Error(`Release ${releaseId} target_commitish ${release.target_commitish} does not match ${expectedSha}.`);
  }
  if (release.tag_name !== expectedTag) {
    throw new Error(`Release ${releaseId} tag_name ${release.tag_name} does not match expected tag ${expectedTag}.`);
  }

  await verifyOrCreateTagRef({ apiUrl, repository, tag: release.tag_name, expectedSha, headers, fetchImpl });

  const allReleases = await listAllReleases({ apiUrl, repository, token, headers, fetchImpl });
  const otherDrafts = allReleases.filter((r) => r.tag_name === release.tag_name && r.draft && r.id !== release.id);
  if (otherDrafts.length > 0) {
    throw new Error(`Conflicting duplicate draft release(s) exist for tag ${release.tag_name}: [${otherDrafts.map((d) => d.id).join(', ')}]`);
  }

  const latestAsset = (release.assets ?? []).find((a) => a.name === 'latest.json');
  if (!latestAsset) throw new Error(`Release ${releaseId} missing latest.json asset.`);
  const assetRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/assets/${validateReleaseId(latestAsset.id)}`, {
    headers: { ...headers, Accept: 'application/octet-stream' },
  });
  if (!assetRes.ok) throw new Error(`Failed to download draft asset latest.json: HTTP ${assetRes.status}`);
  const latestJsonContent = await assetRes.text();
  validateReleaseAssetsAndPlatforms(release, latestJsonContent, candidateVersion, repository);
  await verifyPlatformSignatures(release, latestJsonContent, headers, apiUrl, repository, fetchImpl);

  // Immediate pre-publish re-check of git ref
  await verifyOrCreateTagRef({ apiUrl, repository, tag: release.tag_name, expectedSha, headers, fetchImpl });

  const patchRes = await fetchImpl(`${apiUrl}/repos/${repository}/releases/${releaseId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft: false }),
  });
  if (!patchRes.ok) throw new Error(`Failed to publish release ${releaseId}: HTTP ${patchRes.status}`);
  return await patchRes.json();
};
