import {afterEach,expect,it,vi} from 'vitest';
import {useAuthStore} from '@/stores/authStore';
import {localSubscriptionProviders,formatCrawlPersistenceNotice,formatCrawlRuntimeError} from '@/stores/tools/runtime';
import i18n from '@/i18n';
const initial=useAuthStore.getState();
afterEach(()=>{useAuthStore.setState(initial);vi.restoreAllMocks();delete (window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__;});

it('probes only unconfigured local providers and returns freshly connected providers',async()=>{
  const probe=vi.fn(async(provider:'openai'|'claude'|'gemini')=>{
    useAuthStore.setState(state=>({connectionStatus:{...state.connectionStatus,[provider]:'connected'}}));
    return {success:true,message:'connected'};
  });
  useAuthStore.setState({connectionMethod:{openai:'local_cli',claude:'local_cli',gemini:'local_cli'},connectionStatus:{openai:'unconfigured',claude:'connected',gemini:'error'},testProviderConnection:probe});
  expect(await localSubscriptionProviders()).toEqual(['openai','claude']);
  expect(probe.mock.calls).toEqual([['openai']]);
  expect(await localSubscriptionProviders()).toEqual(['openai','claude']);
  expect(probe).toHaveBeenCalledTimes(1);
});

it('surfaces only actual persistence changes and combines prune and compaction notices',()=>{
  expect(formatCrawlPersistenceNotice({prunedRuns:0},10)).toBeNull();
  const prune=i18n.t('runtimeErrors.tools.quotaLimit',{retained:2,removed:3});
  const compact=i18n.t('runtimeErrors.tools.quotaCompacted');
  expect(formatCrawlPersistenceNotice({prunedRuns:3},2)).toBe(prune);
  expect(formatCrawlPersistenceNotice({prunedRuns:0,compactedRuns:1},2)).toBe(compact);
  expect(formatCrawlPersistenceNotice({prunedRuns:3,compactedRuns:1},2)).toBe(`${prune} ${compact}`);
});

it('distinguishes native disk quota from browser quota and preserves ordinary error messages',()=>{
  expect(formatCrawlRuntimeError('The quota has been exceeded.')).toBe(i18n.t('runtimeErrors.persistence.localQuota'));
  Object.defineProperty(window,'__TAURI_INTERNALS__',{configurable:true,value:{}});
  expect(formatCrawlRuntimeError('The quota has been exceeded.')).toBe(i18n.t('runtimeErrors.persistence.diskQuota'));
  expect(formatCrawlRuntimeError(new Error('fixture failure'))).toBe('fixture failure');
  expect(formatCrawlRuntimeError({})).toBe(i18n.t('runtimeErrors.tools.externalCheckFailed'));
});
