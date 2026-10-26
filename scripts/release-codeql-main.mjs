import { validateGithubApiBase, validateRepository } from './release-input-validation.mjs';

const MAIN_REF = 'refs/heads/main';
const CATEGORIES = ['/language:actions', '/language:javascript-typescript'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => Number.isSafeInteger(value) && value > 0;
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export const evaluateMainCodeqlEvidence = ({ sha, head, analyses, alerts }) => {
  if (!/^[a-f0-9]{40}$/u.test(sha ?? '')) throw new Error('Invalid CodeQL commit SHA');
  if (head?.ref !== MAIN_REF || head?.object?.type !== 'commit' || head.object.sha !== sha) {
    throw new Error('CodeQL main ref does not point to the release SHA');
  }
  if (!Array.isArray(analyses) || !Array.isArray(alerts)) throw new Error('Invalid CodeQL evidence schema');
  const latest = new Map();
  for (const analysis of analyses) {
    if (!isRecord(analysis) || !validId(analysis.id) || !validTime(analysis.created_at)) {
      throw new Error('Invalid CodeQL analysis metadata');
    }
    if (analysis.tool?.name !== 'CodeQL' || !CATEGORIES.includes(analysis.category)) continue;
    const prior = latest.get(analysis.category);
    if (!prior || Date.parse(analysis.created_at) > Date.parse(prior.created_at)
      || (analysis.created_at === prior.created_at && analysis.id > prior.id)) latest.set(analysis.category, analysis);
  }
  if (CATEGORIES.some(category => !latest.has(category))) return { status: 'pending', reason: 'missing language analysis' };
  const selected = CATEGORIES.map(category => latest.get(category));
  if (selected.some(a => a.ref !== MAIN_REF || a.commit_sha !== sha)) return { status: 'pending', reason: 'analysis SHA mismatch' };
  if (selected.some(a => a.error !== '' || a.warning !== '' || !validId(a.rules_count)
    || !Number.isSafeInteger(a.results_count) || a.results_count < 0)) {
    throw new Error('CodeQL analysis contains errors, warnings or invalid result metadata');
  }
  for (const alert of alerts) {
    if (!isRecord(alert) || !validId(alert.number) || alert.state !== 'open') throw new Error('Invalid open CodeQL alert');
  }
  if (alerts.length) throw new Error(`CodeQL main has ${alerts.length} open alerts`);
  return { status: 'success', sha, analysisIds: selected.map(a => a.id), openAlerts: 0 };
};

export const loadMainCodeqlEvidence = async ({
  apiUrl = 'https://api.github.com', repository, sha, token, fetchImpl = fetch,
}) => {
  const base = validateGithubApiBase(apiUrl);
  const repo = validateRepository(repository);
  if (!/^[a-f0-9]{40}$/u.test(sha ?? '') || !token) throw new Error('CodeQL SHA and token are required');
  const request = async suffix => {
    const response = await fetchImpl(`${base}/repos/${repo}/${suffix}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`CodeQL evidence request failed: HTTP ${response.status}`);
    return response.json();
  };
  const head = await request('git/ref/heads/main');
  if (head?.ref !== MAIN_REF || head?.object?.type !== 'commit' || head.object.sha !== sha) {
    throw new Error('CodeQL main ref does not point to the release SHA');
  }
  // GitHub returns newest first. Missing categories fail closed; older pages
  // cannot supply a newer analysis for a release that is absent from this page.
  const analyses = await request('code-scanning/analyses?ref=refs%2Fheads%2Fmain&sort=created&direction=desc&per_page=100');
  if (!Array.isArray(analyses) || analyses.length > 100) throw new Error('Invalid CodeQL analysis list');
  let previousTime = Infinity;
  const analysisIds = new Set();
  for (const analysis of analyses) {
    const time = Date.parse(analysis?.created_at ?? '');
    if (!validId(analysis?.id) || analysisIds.has(analysis.id)) throw new Error('Invalid or duplicate CodeQL analysis');
    if (!Number.isFinite(time) || time > previousTime) throw new Error('CodeQL analyses must be newest first');
    analysisIds.add(analysis.id);
    previousTime = time;
  }
  const alerts = [];
  const seen = new Set();
  for (let page = 1; ; page += 1) {
    if (page > 100) throw new Error('CodeQL alert pagination exceeded its bound');
    const batch = await request(`code-scanning/alerts?ref=refs%2Fheads%2Fmain&state=open&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length > 100) throw new Error('Invalid CodeQL alert list');
    for (const alert of batch) {
      if (!validId(alert?.number) || seen.has(alert.number)) throw new Error('Invalid or duplicate CodeQL alert page');
      seen.add(alert.number);
      alerts.push(alert);
    }
    if (batch.length < 100) break;
  }
  const finalHead = await request('git/ref/heads/main');
  return evaluateMainCodeqlEvidence({ sha, head: finalHead, analyses, alerts });
};
