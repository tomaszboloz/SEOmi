import { writeFileSync, existsSync } from 'node:fs';
import { gh, json, api, read } from './release-watch-gh-read.mjs';
import { fetchCheckRuns } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/scripts/release-ci-check-runs.mjs';
import { summarizeCheckRuns } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/scripts/release-ci-gate.mjs';
import { loadMainCodeqlEvidence } from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/scripts/release-codeql-main.mjs';
const repo = 'tomaszboloz/SEOmi';
const sha = '78e3719c1b49a29708305578b2e281484c367b19';
const ciRun = 40292165841;
const team = '/tmp/seomi-gemini-20261024-1553';
const stateFile = `${team}/qualified-main78-release-state.json`;
const resultFile = `${team}/qualified-main78-release-result.json`;
if (existsSync(resultFile)) throw new Error('A coordinator result already exists; inspect it before a new launch');
let state = { sha, ciRun, pid: process.pid, startedAt: new Date().toISOString(), phase: 'watching-ci', dispatchAttempted: false };
let last = '';
const save = (extra = {}) => {
  state = { ...state, ...extra, observedAt: new Date().toISOString() };
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
  const compact = JSON.stringify({ phase: state.phase, summary: state.summary, releaseRun: state.releaseRun, detail: state.detail });
  if (compact !== last) { console.log(JSON.stringify(state)); last = compact; }
};
const sleep = () => new Promise(resolve => setTimeout(resolve, 30_000));
const mainMatches = async () => { const ref = await api('git/ref/heads/main'); if (ref.object?.sha !== sha || ref.object?.type !== 'commit') throw new Error('Current main changed; refuse release orchestration'); };
const listReleaseRuns = () => json(['run', 'list', '--repo', repo, '--workflow', 'release.yml', '--commit', sha, '--limit', '30', '--json', 'databaseId,status,conclusion,event,headSha']);
const publicRelease = async () => {
  const response = await read(`https://api.github.com/repos/${repo}/releases/tags/v0.4.41`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Release metadata HTTP ${response.status}`);
  const release = await response.json();
  if (release.draft) return null;
  let tag = await api('git/ref/tags/v0.4.41');
  for (let depth = 0; tag.object?.type === 'tag' && depth < 5; depth++) tag = await api(`git/tags/${tag.object.sha}`);
  if (tag.object?.sha !== sha || tag.object?.type !== 'commit') throw new Error('Published tag does not match qualified main');
  return { id: release.id, url: release.html_url, tag: release.tag_name, publishedAt: release.published_at, assets: release.assets.map(a => ({ id: a.id, name: a.name, size: a.size, digest: a.digest })) };
};
try {
  save();
  while (true) {
    await mainMatches();
    const ci = json(['run', 'view', String(ciRun), '--repo', repo, '--json', 'status,conclusion,headSha']);
    if (ci.headSha !== sha) throw new Error('CI source SHA mismatch');
    if (ci.status === 'completed' && ci.conclusion !== 'success') throw new Error(`Required main CI ended ${ci.conclusion}`);
    const runs = await fetchCheckRuns({ apiUrl: 'https://api.github.com', repository: repo, sha, token: 'gh-authenticated-read-boundary', fetchImpl: read });
    const summary = summarizeCheckRuns(runs, undefined, sha);
    save({ phase: 'watching-ci', summary });
    if (summary.failed.length) throw new Error(`Exact-main checks failed: ${summary.failed.join(', ')}`);
    const allTen = summary.pending.length === 0 && (summary.missing.length === 0 || (summary.missing.length === 1 && summary.missing[0] === 'CodeQL'));
    if (allTen && ci.status === 'completed' && ci.conclusion === 'success') {
      const proof = await loadMainCodeqlEvidence({ repository: repo, sha, token: 'gh-authenticated-read-boundary', fetchImpl: read });
      if (proof.status === 'success') {
        writeFileSync(`${team}/main78-qualified-evidence.json`, JSON.stringify({ at: new Date().toISOString(), sha, ci, checkRuns: runs, summary, nativeCodeql: proof }, null, 2) + '\n');
        save({ phase: 'qualified', proof });
        break;
      }
      save({ phase: 'waiting-native-codeql', detail: proof.reason });
    }
    await sleep();
  }
  await mainMatches();
  let published = await publicRelease();
  let runs = listReleaseRuns();
  let active = runs.filter(r => r.status !== 'completed');
  if (active.length > 1) throw new Error('Multiple packaging runs already active; do not add a duplicate');
  if (!published && active.length === 0) {
    const latest = runs[0];
    if (latest) {
      if (latest.event !== 'push' || latest.conclusion !== 'failure') throw new Error('Prior packaging needs manual diagnosis; no blind retry');
      const failedLog = gh(['run', 'view', String(latest.databaseId), '--repo', repo, '--log-failed']);
      if (!failedLog.includes(`Timed out waiting for required CI for ${sha}:`)) throw new Error('Packaging failed for a reason other than pending CI; no blind retry');
    }
    await mainMatches();
    save({ phase: 'dispatching-qualified-release', dispatchAttempted: true, previousReleaseRuns: runs.map(r => r.databaseId) });
    gh(['workflow', 'run', 'release.yml', '--ref', 'main', '--repo', repo]);
    for (let attempt = 0; attempt < 10; attempt++) {
      await sleep(); runs = listReleaseRuns();
      active = runs.filter(r => !state.previousReleaseRuns.includes(r.databaseId) && r.event === 'workflow_dispatch');
      if (active.length) break;
    }
    if (active.length !== 1) throw new Error('Dispatch outcome unresolved; inspect remote runs before any new dispatch');
  }
  if (!published) {
    state.releaseRun = active[0].databaseId;
    while (true) {
      await mainMatches();
      const run = json(['run', 'view', String(state.releaseRun), '--repo', repo, '--json', 'status,conclusion,headSha,jobs']);
      if (run.headSha !== sha) throw new Error('Packaging source SHA mismatch');
      const detail = run.jobs.map(j => ({ name: j.name, status: j.status, conclusion: j.conclusion }));
      save({ phase: 'watching-packaging', detail });
      if (run.status === 'completed') {
        if (run.conclusion !== 'success') throw new Error(`Qualified packaging ended ${run.conclusion}; no automatic rerun`);
        published = await publicRelease();
        if (!published) throw new Error('Packaging reported success without a public release');
        break;
      }
      await sleep();
    }
  }
  save({ phase: 'published-pending-independent-asset-audit', published, detail: 'Public tag matches exact qualified main; root must audit assets/updater/checksums/attestation before completion claims' });
  writeFileSync(resultFile, JSON.stringify({ ...state, coordinatorExit: 0 }, null, 2) + '\n');
} catch (error) {
  save({ phase: 'needs-attention', detail: String(error.message), error: true });
  writeFileSync(resultFile, JSON.stringify({ ...state, coordinatorExit: 1 }, null, 2) + '\n');
  process.exitCode = 1;
}
