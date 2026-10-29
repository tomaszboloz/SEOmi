import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const src = '/Users/tomaszboloz/.codex/worktrees/task-tracker/seomi/src';
const require = createRequire('/Users/tomaszboloz/.codex/worktrees/release-next/seomi/package.json');
const ts = require('typescript');
const hashes = {}, cases = [];
const oldRun = { id: 'old-completed', completedAt: '2026-01-01T00:00:00Z', startUrl: 'https://real.test/', result: { pages: [] } };
const wire = (seq, eventType, payload) => ({ projectId: 'p', runId: 'new-active', seq, eventType, at: '2026-10-25T09:59:00Z', payload });
const fresh = [wire(1, 'crawl:started', { id: 'new-active', startUrl: 'https://real.test/', config: { crawl_mode: 'http' } }), wire(2, 'crawl:page', { url: 'https://real.test/page', http_status: 200 })];
async function execute(existingSnapshots) {
  const calls = [], cache = new Map();
  const invoke = async (cmd, args) => { calls.push({ cmd, args }); return args.runId === 'old-completed' ? [wire(1, 'crawl:started', { id: 'old-completed' })] : fresh; };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith('/services/tauri.ts')) return { isTauriEnvironment: () => true, invokeTauriCommand: invoke };
    if (file.endsWith('/i18n/index.ts')) return { default: { t: key => key, language: 'en' }, t: key => key };
    if (file.endsWith('/crawlStore/index.ts')) return { migrateLegacyCrawlRuns: async () => {}, loadStoredRuns: async () => existingSnapshots, listStoredRuns: async () => existingSnapshots, loadStoredRun: async () => oldRun, saveStoredRuns: async () => {} };
    if (file.endsWith('/crawlPersistence/browser.ts')) return { indexedDbWrite: async () => {} };
    if (file.endsWith('/crawlPersistence/indexedDb.ts')) return { indexedDbRead: async () => [] };
    if (file.endsWith('/crawlPersistence/legacy.ts')) return { clearLegacyCrawlStorage: () => {} };
    const source = readFileSync(file, 'utf8');
    hashes[file] = createHash('sha256').update(source).digest('hex');
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} }; cache.set(file, module.exports);
    const importer = spec => {
      if (!spec.startsWith('.') && !spec.startsWith('@/')) return require(spec);
      const base = spec.startsWith('@/') ? resolve(src, spec.slice(2)) : resolve(dirname(file), spec);
      return load([base + '.ts', resolve(base, 'index.ts')].find(existsSync));
    };
    vm.runInThisContext('(function(require,module,exports){' + output + '\n})', { filename: file })(importer, module, module.exports);
    return module.exports;
  }
  const api = load(resolve(src, 'services/crawlPersistence.ts'));
  const result = await api.loadCrawlRuns('p');
  const metrics = result[0]?.result;
  return { returnedIds: result.map(run => run.id), firstResult: result[0], healthIsNaN: Number.isNaN(metrics?.health_score), durationIsNaN: Number.isNaN(metrics?.duration_ms), requests: calls };
}
cases.push({ case: 'Older completed snapshot exists with newer durable in-flight events', expected: 'new-active observation must be replayed into result alongside older history', actual: await execute([oldRun]) });
cases.push({ case: 'No completed snapshot exists, only durable in-flight events', expected: 'new-active with observed pages and honest unavailable metrics', actual: await execute([]) });
const report = { at: new Date().toISOString(), scope: 'Original production loadCrawlRuns -> replay -> sqliteEventSink executed, snapshot store and native IPC boundaries injected; no production edits', hashes, cases };
writeFileSync('/tmp/seomi-gemini-20261024-1553/auditor-crawl-load-projection-v2-findings.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
