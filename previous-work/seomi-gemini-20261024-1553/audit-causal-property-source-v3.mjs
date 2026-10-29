import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
const root = '/Users/tomaszboloz/.codex/worktrees/causal-runtime/seomi';
const require = createRequire(root + '/package.json');
const ts = require('typescript');
const cache = new Map(), hashes = {};
function load(file) {
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('/gscTracker/read.ts')) return { readGscSnapshots: () => [] };
  if (file.endsWith('/experiments/registry.ts')) return { listInterventions: () => [] };
  const source = readFileSync(file, 'utf8');
  hashes[file] = createHash('sha256').update(source).digest('hex');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  cache.set(file, module.exports);
  const importModule = specifier => {
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return require(specifier);
    const base = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2)) : resolve(dirname(file), specifier);
    return load([base + '.ts', resolve(base, 'index.ts')].find(existsSync));
  };
  vm.runInThisContext('(function(require,module,exports){' + output + '\n})', { filename: file })(importModule, module, module.exports);
  return module.exports;
}
const adapter = load(root + '/src/services/causalMarket/adapter.ts');
const source = load(root + '/src/services/causalMarket/source.ts');
const dates = Array.from({ length: 28 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
const snapshot = (id, site, post) => ({ id, site_url: site, captured_at: '2026-03-29T00:00:00Z', daily: dates.map((date, i) => ({ date, clicks: i < 14 ? 100 : post, impressions: 1000, ctr: 0.1, position: 2 })) });
const base = {
  interventions: [{ id: 'i', projectId: 'p', url: 'site', kind: 'content', date: '2026-03-15', createdAt: '2026-03-14T00:00:00Z', note: '' }],
  market: { status: 'available', source: 'dataforseo-serp-volatility', observations: dates.map(date => ({ date, level: 4 })) },
  updateWindows: [],
};
const cases = [
  { case: 'Requested URL-prefix property has no snapshots but sibling prefix on same host does', expected: 'null; sibling property is not target evidence', actual: adapter.buildCausalImpact({ ...base, testSiteUrl: 'https://example.com/blog/', snapshots: [snapshot('wrong-prefix', 'https://example.com/store/', 60), snapshot('control', 'https://independent.test/', 100)] }) },
  { case: 'Requested app subdomain absent but www property has snapshots', expected: 'null; same registered domain is not same GSC property', actual: adapter.buildCausalImpact({ ...base, testSiteUrl: 'https://app.example.com/', snapshots: [snapshot('wrong-subdomain', 'https://www.example.com/', 60), snapshot('control', 'https://independent.test/', 100)] }) },
  { case: 'Exact requested property exists as well as longer sibling dataset', expected: 'no-effect0 from exact property', actual: adapter.buildCausalImpact({ ...base, testSiteUrl: 'https://example.com/blog/', snapshots: [snapshot('wrong-prefix', 'https://example.com/store/', 60), snapshot('right-prefix', 'https://example.com/blog/', 100), snapshot('control', 'https://independent.test/', 100)] }) },
  { case: 'Malformed explicit Google Ranking end date', expected: 'reject malformed window rather than convert to ongoing', actual: source.parseGoogleSearchStatus([{ service_name: 'Ranking', begin: '2026-03-01', end: 'invalid' }]) },
];
cases.push({case: 'Case-sensitive GSC URL prefix /BLOG/ must not match /blog/', expected: 'null: URL paths remain case-sensitive', actual: adapter.buildCausalImpact({...base,testSiteUrl:'https://example.com/blog/',snapshots:[snapshot('wrong-case','https://example.com/BLOG/',60),snapshot('control','https://independent.test/',100)]})});
const report = { at: new Date().toISOString(), scope: 'Original frozen root TS executed; only storage reader boundaries stubbed, no network or production edits', hashes, cases };
writeFileSync('/tmp/seomi-gemini-20261024-1553/auditor-causal-property-source-v3-findings.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(cases, null, 2));
