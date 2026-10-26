import { appendFileSync } from 'node:fs';

export const validateReleaseVersion = (value) => {
  if (typeof value !== 'string') throw new Error('Invalid stable release version');
  const parts = value.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^(0|[1-9][0-9]*)$/.test(part))) throw new Error('Invalid stable release version');
  const numbers = parts.map(Number);
  if (!numbers.every(Number.isSafeInteger) || numbers.join('.') !== value) throw new Error('Invalid stable release version');
  return numbers.join('.');
};

export const validateReleaseTag = (value) => {
  if (typeof value !== 'string' || value[0] !== 'v') throw new Error('Invalid release tag');
  return `v${validateReleaseVersion(value.slice(1))}`;
};

export const validateRepository = (value) => {
  if (typeof value !== 'string' || value.trim() !== value || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(value)) {
    throw new Error('Invalid GitHub repository');
  }
  const [owner, name] = value.split('/');
  if (name === '.' || name === '..' || `${owner}/${name}` !== value) throw new Error('Invalid GitHub repository');
  return `${owner}/${name}`;
};

export const validateGithubApiBase = (value, upload = false) => {
  const expected = upload ? 'https://uploads.github.com' : 'https://api.github.com';
  if (value !== expected) throw new Error(`GitHub API origin must be ${expected}`);
  return upload ? 'https://uploads.github.com' : 'https://api.github.com';
};

export const validateReleaseId = (value) => {
  const id = typeof value === 'number' ? value : typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id < 1 || (typeof value === 'string' && String(id) !== value)) throw new Error('Invalid release ID');
  return id;
};

export const validateGitHubReleaseContext = ({ apiUrl = 'https://api.github.com', uploadUrl = 'https://uploads.github.com', repository, releaseId }) => ({
  apiUrl: validateGithubApiBase(apiUrl), uploadUrl: validateGithubApiBase(uploadUrl, true),
  repository: validateRepository(repository), releaseId: validateReleaseId(releaseId),
});

export const writeGithubOutput = (key, value, outputPath = process.env.GITHUB_OUTPUT) => {
  let safeValue;
  if (key === 'tag') safeValue = validateReleaseTag(value);
  else if (key === 'release_id') safeValue = String(validateReleaseId(value));
  else if (key === 'publish' && (value === 'true' || value === 'false')) safeValue = value === 'true' ? 'true' : 'false';
  else throw new Error('Invalid GitHub output');
  if (outputPath) appendFileSync(outputPath, `${key}=${safeValue}\n`);
};
