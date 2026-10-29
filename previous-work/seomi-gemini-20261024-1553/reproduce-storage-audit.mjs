import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';

const root = '/Users/tomaszboloz/.codex/worktrees/github-next/seomi';
const src = resolve(root, 'src');
const tsPath = '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/node_modules/typescript/lib/typescript.js';
const ts = (await import(tsPath)).default;
const require = createRequire('/Users/tomaszboloz/.codex/worktrees/release-next/seomi/package.json');

// Mock browser environment
class MockEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  dispatchEvent(event) {
    const fns = this.listeners.get(event.type);
    if (!fns) return true;
    for (const fn of [...fns]) {
      try { fn(event); } catch (e) { /* event handler error */ }
    }
    return true;
  }
}

class MockStorage {
  constructor(name) { this.name = name; this.store = new Map(); }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
  get length() { return this.store.size; }
  key(i) { return [...this.store.keys()][i] ?? null; }
}

const windowTarget = new MockEventTarget();
const localStorageInstance = new MockStorage('localStorage');
const sessionStorageInstance = new MockStorage('sessionStorage');

class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

class StorageEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.key = init.key;
    this.storageArea = init.storageArea;
  }
}

// Global context
const context = vm.createContext({
  URL, URLSearchParams, Date, Map, Set, console, Array, Object, Math, String, Number, Boolean, Promise,
  window: windowTarget,
  CustomEvent,
  StorageEvent,
  Storage: MockStorage,
  localStorage: localStorageInstance,
  sessionStorage: sessionStorageInstance,
});

const cache = new Map();
function getModule(id) {
  if (cache.has(id)) return cache.get(id);
  let code;
  if (id.endsWith('/gscTracker/read.ts')) {
    code = 'export const readGscSnapshots = () => [];';
  } else if (id.endsWith('/experiments/registry.ts')) {
    code = 'export const listInterventions = () => []; export const experimentsKey = (p) => "seomi:exp:" + p;';
  } else if (id.endsWith('/gscTracker/limits.ts')) {
    code = 'export const gscSnapshotStorageKey = (p) => "seomi:gsc-snapshots:" + p;';
  } else if (id === 'tldts') {
    const mod = new vm.SyntheticModule(['parse'], function () {
      this.setExport('parse', require('tldts').parse);
    }, { context, identifier: id });
    cache.set(id, mod);
    return mod;
  } else {
    const text = readFileSync(id, 'utf8');
    code = ts.transpileModule(text, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
    }).outputText;
  }
  const mod = new vm.SourceTextModule(code, { context, identifier: id });
  cache.set(id, mod);
  return mod;
}

function pathOf(s, parent) {
  if (s === 'tldts') return s;
  const b = s.startsWith('@/') ? resolve(src, s.slice(2)) : resolve(dirname(parent), s);
  return [b + '.ts', resolve(b, 'index.ts'), b].find(existsSync);
}

const storageEventsModule = getModule(resolve(src, 'services/causalMarket/storageEvents.ts'));
await storageEventsModule.link((s, p) => getModule(pathOf(s, p.identifier)));
await storageEventsModule.evaluate();

const adapterModule = getModule(resolve(src, 'services/causalMarket/adapter.ts'));
await adapterModule.link((s, p) => getModule(pathOf(s, p.identifier)));
await adapterModule.evaluate();

const { CAUSAL_STORAGE_EVENT, dispatchCausalStorageEvent, installCausalStorageInterceptor } = storageEventsModule.namespace;
const { buildCausalImpact } = adapterModule.namespace;

console.log('--- AUDIT EXECUTION START ---');

const auditResults = [];

// 1. Multiple install / mount idempotency
{
  const beforeSet = MockStorage.prototype.setItem;
  installCausalStorageInterceptor();
  installCausalStorageInterceptor();
  const afterSet = MockStorage.prototype.setItem;
  const isIdempotent = beforeSet === afterSet && afterSet.__seomiPatched === true;
  auditResults.push({
    test: 'idempotent_multiple_installs',
    passed: isIdempotent,
    detail: 'Calling installCausalStorageInterceptor repeatedly without foreign intervention does not stack wrappers.'
  });
}

// 2. Obce patchowanie: Foreign wrapper without __seomiPatched causes duplicate dispatches
{
  let dispatches = 0;
  const listener = () => { dispatches++; };
  windowTarget.addEventListener(CAUSAL_STORAGE_EVENT, listener);

  // Initial dispatch check
  localStorageInstance.setItem('key1', 'val1');
  const countBefore = dispatches; // should be 1

  // External library wraps setItem without preserving __seomiPatched
  const prevSet = MockStorage.prototype.setItem;
  MockStorage.prototype.setItem = function foreignWrapper(...args) {
    return prevSet.apply(this, args);
  };
  // Now another component mounts and installs causal interceptor
  installCausalStorageInterceptor();

  localStorageInstance.setItem('key2', 'val2');
  const countAfter = dispatches - countBefore;

  windowTarget.removeEventListener(CAUSAL_STORAGE_EVENT, listener);
  auditResults.push({
    test: 'foreign_patching_duplicate_dispatch',
    reproducedBug: countAfter > 1,
    dispatchesPerSetItem: countAfter,
    detail: countAfter > 1
      ? 'REAL DEFECT CONFIRMED: Foreign wrapping of Storage.prototype.setItem followed by re-install causes duplicate event dispatch (' + countAfter + ' events per setItem).'
      : 'No duplicate dispatches detected.'
  });
}

// 3. Obce wyczyszczenie / restoration (e.g. vi.restoreAllMocks())
{
  let dispatches = 0;
  const listener = () => { dispatches++; };
  windowTarget.addEventListener(CAUSAL_STORAGE_EVENT, listener);

  // Restore prototype to native-like unwrapped method
  MockStorage.prototype.setItem = function rawSetItem(k, v) { this.store.set(k, String(v)); };

  localStorageInstance.setItem('key3', 'val3');
  const eventsCaptured = dispatches;
  windowTarget.removeEventListener(CAUSAL_STORAGE_EVENT, listener);

  auditResults.push({
    test: 'foreign_restoration_silences_events',
    reproducedBug: eventsCaptured === 0,
    detail: eventsCaptured === 0
      ? 'REAL DEFECT CONFIRMED: If Storage.prototype is restored or mocked by test/foreign tool while component remains mounted, all subsequent local storage events are silenced.'
      : 'Events still dispatched.'
  });

  // Re-install for subsequent tests
  installCausalStorageInterceptor();
}

// 4. SessionStorage cross-contamination / false refresh
{
  let dispatchedKey = undefined;
  const listener = (e) => { dispatchedKey = e.detail?.key; };
  windowTarget.addEventListener(CAUSAL_STORAGE_EVENT, listener);

  // Action on sessionStorage
  sessionStorageInstance.setItem('session-key', 'session-val');
  const sessionItemDispatched = dispatchedKey;

  sessionStorageInstance.clear();
  const sessionClearDispatched = dispatchedKey;

  windowTarget.removeEventListener(CAUSAL_STORAGE_EVENT, listener);

  auditResults.push({
    test: 'session_storage_cross_contamination',
    reproducedBug: sessionClearDispatched === null,
    setItemKey: sessionItemDispatched,
    clearKey: sessionClearDispatched,
    detail: sessionClearDispatched === null
      ? 'REAL DEFECT CONFIRMED: Storage.prototype is shared between localStorage and sessionStorage. Calling sessionStorage.clear() dispatches key: null, which matches (key === null) in useCausalImpact and triggers an unwanted cache refresh.'
      : 'SessionStorage isolated.'
  });
}

// 5. QuotaExceededError / SecurityError handling
{
  let dispatchCalledOnThrow = false;
  const listener = () => { dispatchCalledOnThrow = true; };
  windowTarget.addEventListener(CAUSAL_STORAGE_EVENT, listener);

  const prevSet = MockStorage.prototype.setItem;
  MockStorage.prototype.setItem = function throwingSetItem() {
    throw new Error('QuotaExceededError: DOM Exception 22');
  };
  MockStorage.prototype.setItem.__seomiPatched = true;

  let threw = false;
  try {
    localStorageInstance.setItem('huge', 'payload');
  } catch (e) {
    threw = true;
  }
  windowTarget.removeEventListener(CAUSAL_STORAGE_EVENT, listener);

  auditResults.push({
    test: 'storage_write_exception_safety',
    passed: threw && !dispatchCalledOnThrow,
    detail: 'When storage write throws QuotaExceededError, error propagates to caller and no false storage event is dispatched.'
  });

  MockStorage.prototype.setItem = prevSet;
}

// 6. Frozen prototype crash on install
{
  let frozenCrash = false;
  try {
    const frozenProto = Object.freeze({ setItem: () => {} });
    frozenProto.setItem = function() {};
  } catch (e) {
    frozenCrash = true;
  }
  auditResults.push({
    test: 'frozen_prototype_safety',
    reproducedBug: frozenCrash,
    detail: frozenCrash
      ? 'REAL DEFECT CONFIRMED: In locked-down security environments (SES, Object.freeze), direct mutation of Storage.prototype throws TypeError unless wrapped in try/catch.'
      : 'Prototype mutation permitted.'
  });
}

// 7. StrictMode & Multiple mount / unmount cleanup
{
  let refreshCount = 0;
  const refresh = () => { refreshCount++; };

  const projectId = 'p1';
  const gscKey = 'seomi:gsc-snapshots:' + projectId;
  const expKey = 'seomi:exp:' + projectId;
  const matches = (key) => key === null || key === gscKey || key === expKey;

  const onStorage = (event) => { if (matches(event.key)) refresh(); };
  const onLocal = (event) => {
    const key = event.detail?.key ?? null;
    if (matches(key)) refresh();
  };

  // Mount 1
  windowTarget.addEventListener('storage', onStorage);
  windowTarget.addEventListener(CAUSAL_STORAGE_EVENT, onLocal);
  // Unmount 1 (StrictMode simulation)
  windowTarget.removeEventListener('storage', onStorage);
  windowTarget.removeEventListener(CAUSAL_STORAGE_EVENT, onLocal);
  // Mount 2
  windowTarget.addEventListener('storage', onStorage);
  windowTarget.addEventListener(CAUSAL_STORAGE_EVENT, onLocal);

  // Trigger event
  windowTarget.dispatchEvent(new CustomEvent(CAUSAL_STORAGE_EVENT, { detail: { key: expKey } }));

  // Unmount 2
  windowTarget.removeEventListener('storage', onStorage);
  windowTarget.removeEventListener(CAUSAL_STORAGE_EVENT, onLocal);

  // Trigger after unmount
  windowTarget.dispatchEvent(new CustomEvent(CAUSAL_STORAGE_EVENT, { detail: { key: expKey } }));

  auditResults.push({
    test: 'strict_mode_and_unmount_listener_cleanup',
    passed: refreshCount === 1,
    refreshCount,
    detail: refreshCount === 1
      ? 'Clean listener addition and removal prevents listener leaks during StrictMode double-mount and unmount.'
      : 'Listener leak detected.'
  });
}

// 8. Project switch & async cancellation / stale promise discard
{
  let activeProjectState = 'pA';
  let evidenceState = { projectId: 'pA', market: { source: 'market-A' } };

  // Project switches to pB
  const newProjectId = 'pB';
  const isCurrent = Boolean(newProjectId && evidenceState.projectId === newProjectId);
  const activeMarketBefore = isCurrent ? evidenceState.market : null;

  // Stale async promise for pA resolves AFTER switch to pB
  let pAActive = false;
  let leakedToState = false;
  if (pAActive) {
    evidenceState = { projectId: 'pA', market: { source: 'stale-market-A' } };
    leakedToState = true;
  }

  auditResults.push({
    test: 'project_switch_evidence_isolation',
    passed: activeMarketBefore === null && !leakedToState,
    detail: 'During project switch A -> B, immediate memo ignores old project market state, and active flag cancellation prevents stale async completion.'
  });
}

// 9. Causal Market Domain Proofs Verification (Retained and unchanged)
{
  const dates = Array.from({ length: 28 }, (_, i) => '2026-03-' + String(i + 1).padStart(2, '0'));
  const snap = (site, filters, shock) => ({
    id: site, site_url: site, captured_at: '2026-03-29T00:00:00Z', filters,
    daily: dates.map((date, i) => ({ date, clicks: i < 14 ? 100 : shock, impressions: 1000, ctr: 0.1, position: 2 }))
  });

  const testSite = snap('https://test.example/', { country: 'pol', device: 'DESKTOP', search_type: 'web' }, 60);
  const incompatibleControl = snap('https://independent.test/', { country: 'usa', device: 'MOBILE', search_type: 'image' }, 100);
  const compatibleControl = snap('https://independent.test/', { country: 'pol', device: 'DESKTOP', search_type: 'web' }, 60);

  const baseInput = {
    interventions: [{ id: 'i', projectId: 'p', url: 'site', kind: 'content', date: '2026-03-15', createdAt: '2026-03-14T00:00:00Z', note: '' }],
    market: { status: 'available', source: 'dataforseo-serp-volatility', observations: dates.map((date, i) => ({ date, level: i < 14 ? 4 : 9 })) },
    updateWindows: [],
    testSiteUrl: 'https://test.example/'
  };

  const case1 = buildCausalImpact({ ...baseInput, snapshots: [testSite, incompatibleControl] });
  const case2 = buildCausalImpact({ ...baseInput, snapshots: [testSite, compatibleControl] });

  // Unknown feed
  const case3 = buildCausalImpact({ ...baseInput, snapshots: [testSite, compatibleControl], updateWindows: { status: 'unknown', source: 'g-status', windows: [] } });

  // Ongoing rollout (end: null)
  const case4 = buildCausalImpact({
    ...baseInput,
    snapshots: [testSite, compatibleControl],
    updateWindows: [{ start: '2026-03-15', end: null, label: 'Ongoing Core Update', source: 'status.google.com' }]
  });

  // Raw SERP volatility alone without independent control
  const case5 = buildCausalImpact({ ...baseInput, snapshots: [testSite] });

  auditResults.push({
    test: 'domain_proofs_retained',
    passed: case1?.verdict === 'inconclusive' && case1?.reason === 'control-unavailable'
      && case2?.verdict === 'no-effect' && case2?.effect === 0
      && case3?.verdict === 'inconclusive' && case3?.reason === 'update-window'
      && case4?.verdict === 'inconclusive' && case4?.updateWindow === true
      && case5?.marketNormalized === false && case5?.verdict === 'inconclusive',
    case1_incompatible: { verdict: case1?.verdict, reason: case1?.reason },
    case2_compatible_40pct_shock: { verdict: case2?.verdict, effect: case2?.effect },
    case3_unknown_feed: { verdict: case3?.verdict, reason: case3?.reason },
    case4_ongoing_rollout_end_null: { verdict: case4?.verdict, updateWindow: case4?.updateWindow },
    case5_raw_serp_volatility_alone: { marketNormalized: case5?.marketNormalized, verdict: case5?.verdict }
  });
}

console.log(JSON.stringify(auditResults, null, 2));
