import { readFileSync } from 'node:fs';
import { createOrGetDraftRelease, verifyAndPublishDraftRelease } from './release-ci-gate-assets.mjs';
import { validateReleaseVersion, validateReleaseTag, validateRepository, validateGithubApiBase, writeGithubOutput } from './release-input-validation.mjs';

export const resolveExpectedTag = (packageJsonPath = './package.json') => {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (!pkg?.version) throw new Error('package.json does not define a version.');
  return `v${validateReleaseVersion(pkg.version)}`;
};

export const resolveReleaseTag = ({ refType, refName, packageVersion, tagExistsRemote = false }) => {
  const expectedTag = `v${validateReleaseVersion(packageVersion)}`;
  if (refType === 'tag') {
    if (refName !== expectedTag) {
      throw new Error(`Release tag ${refName} does not match expected version tag ${expectedTag}.`);
    }
    return { tag: refName, publish: true };
  }
  return { tag: expectedTag, publish: !tagExistsRemote };
};

export const checkTagExistsRemote = async ({
  apiUrl = 'https://api.github.com', repository, tag, token, fetchImpl = fetch,
}) => {
  if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
  const response = await fetchImpl(`${validateGithubApiBase(apiUrl)}/repos/${validateRepository(repository)}/git/ref/tags/${encodeURIComponent(validateReleaseTag(tag))}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`GitHub tag ref check failed: HTTP ${response.status}`);
  return true;
};

export const verifyTagTargetCommit = async ({
  apiUrl = 'https://api.github.com', repository, tag, expectedSha, token, fetchImpl = fetch,
}) => {
  if (!/^[\da-f]{40}$/u.test(expectedSha ?? '')) throw new Error(`Invalid release commit SHA: ${expectedSha}`);
  if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
  apiUrl = validateGithubApiBase(apiUrl); repository = validateRepository(repository); tag = validateReleaseTag(tag);
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const response = await fetchImpl(`${validateGithubApiBase(apiUrl)}/repos/${validateRepository(repository)}/git/ref/tags/${encodeURIComponent(validateReleaseTag(tag))}`, { headers });
  if (response.status === 404) throw new Error(`Release tag ${tag} not found in remote repository.`);
  if (!response.ok) throw new Error(`GitHub tag ref request failed: HTTP ${response.status}`);
  const refData = await response.json();
  let commitSha = refData?.object?.sha;
  if (refData?.object?.type === 'tag') {
    const tagRes = await fetchImpl(`${apiUrl}/repos/${repository}/git/tags/${commitSha}`, { headers });
    if (!tagRes.ok) throw new Error(`GitHub annotated tag lookup failed: HTTP ${tagRes.status}`);
    commitSha = (await tagRes.json())?.object?.sha;
  }
  if (commitSha !== expectedSha) {
    throw new Error(`Release tag ${tag} points to ${commitSha}, expected ${expectedSha}.`);
  }
  return { tag, commitSha, objectType: refData?.object?.type };
};

export const ensureTagRefTarget = async ({
  apiUrl = 'https://api.github.com', repository, tag, expectedSha, token, fetchImpl = fetch,
}) => {
  if (!/^[\da-f]{40}$/u.test(expectedSha ?? '')) throw new Error(`Invalid release commit SHA: ${expectedSha}`);
  apiUrl = validateGithubApiBase(apiUrl); repository = validateRepository(repository); tag = validateReleaseTag(tag);
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const res = await fetchImpl(`${validateGithubApiBase(apiUrl)}/repos/${validateRepository(repository)}/git/ref/tags/${encodeURIComponent(validateReleaseTag(tag))}`, { headers });
  if (res.status === 404) {
    const create = await fetchImpl(`${apiUrl}/repos/${repository}/git/refs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: expectedSha }),
    });
    if (!create.ok) throw new Error(`Failed to create git ref for tag ${tag}: HTTP ${create.status}`);
    return { tag, commitSha: expectedSha, created: true };
  }
  return await verifyTagTargetCommit({ apiUrl, repository, tag, expectedSha, token, fetchImpl });
};

export const validateReleaseGateTag = async ({
  refType, refName, packageVersion, expectedSha, repository, token,
  apiUrl = 'https://api.github.com', fetchImpl = fetch, tagExistsRemote = false,
}) => {
  const { tag, publish } = resolveReleaseTag({ refType, refName, packageVersion, tagExistsRemote });
  if (refType === 'tag') {
    await verifyTagTargetCommit({ apiUrl, repository, tag, expectedSha, token, fetchImpl });
  }
  return { tag, publish };
};

export const runReleaseGateTagCli = async (
  env = process.env, args = process.argv.slice(2), fetchImpl = fetch, packageJsonPath = './package.json',
) => {
  const pkgVersion = validateReleaseVersion(JSON.parse(readFileSync(packageJsonPath, 'utf8')).version);
  const refType = env.GITHUB_REF_TYPE;
  const refName = env.GITHUB_REF_NAME;
  const expectedSha = env.RELEASE_COMMIT_SHA ?? env.GITHUB_SHA;
  const repository = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN ?? env.GH_TOKEN;
  const apiUrl = env.GITHUB_API_URL ?? 'https://api.github.com';

  if (args.includes('--preflight')) {
    const tag = refType === 'tag' ? refName : `v${pkgVersion}`;
    if (refType === 'tag') {
      if (refName !== `v${pkgVersion}`) throw new Error(`Release tag ${refName} does not match expected version tag v${pkgVersion}.`);
      await verifyTagTargetCommit({ apiUrl, repository, tag, expectedSha, token, fetchImpl });
      writeGithubOutput('tag', tag, env.GITHUB_OUTPUT);
      writeGithubOutput('publish', 'true', env.GITHUB_OUTPUT);
      return { tag, publish: true };
    }
    const exists = await checkTagExistsRemote({ apiUrl, repository, tag, token, fetchImpl });
    writeGithubOutput('tag', tag, env.GITHUB_OUTPUT);
    writeGithubOutput('publish', exists ? 'false' : 'true', env.GITHUB_OUTPUT);
    return { tag, publish: !exists };
  }
  if (args.includes('--create-draft')) {
    const tag = env.RELEASE_TAG ?? (refType === 'tag' ? refName : `v${pkgVersion}`);
    if (tag !== `v${pkgVersion}`) throw new Error(`Release tag ${tag} does not match local package version v${pkgVersion}.`);
    const releaseId = await createOrGetDraftRelease({
      apiUrl, repository, tag, commitSha: expectedSha, candidateVersion: pkgVersion, token, fetchImpl,
    });
    writeGithubOutput('release_id', releaseId, env.GITHUB_OUTPUT);
    return { releaseId };
  }
  if (args.includes('--ensure-tag-ref')) {
    const releaseTag = env.RELEASE_TAG ?? `v${pkgVersion}`;
    if (releaseTag !== `v${pkgVersion}`) throw new Error(`Release tag ${releaseTag} does not match expected version tag v${pkgVersion}.`);
    return await ensureTagRefTarget({ apiUrl, repository, tag: releaseTag, expectedSha, token, fetchImpl });
  }
  if (args.includes('--verify')) {
    const releaseTag = env.RELEASE_TAG ?? `v${pkgVersion}`;
    if (releaseTag !== `v${pkgVersion}`) throw new Error(`Release tag ${releaseTag} does not match expected version tag v${pkgVersion}.`);
    return await verifyTagTargetCommit({ apiUrl, repository, tag: releaseTag, expectedSha, token, fetchImpl });
  }
  if (args.includes('--publish-draft')) {
    const releaseId = Number(env.RELEASE_ID);
    return await verifyAndPublishDraftRelease({
      apiUrl, repository, releaseId, expectedSha, candidateVersion: pkgVersion, token, fetchImpl,
    });
  }
};

if (process.argv[1]?.endsWith('release-ci-gate-tag.mjs')) {
  runReleaseGateTagCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
