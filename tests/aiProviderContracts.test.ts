import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AIService } from '@/services/ai';
import type { AiProvider } from '@/types';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';
const invoke = vi.hoisted(()=>vi.fn());
vi.mock('@/services/tauri',()=>({invokeTauriCommand:invoke}));
const suggestions = {suggestedTitle:'Observed title',suggestedDescription:'Observed description',keyImprovements:['Describe actual content'],schemaJsonLd:{'@type':'WebPage'}};
const responseFor = (provider:AiProvider, content:string) => provider==='openai'?{choices:[{message:{content}}]}:provider==='claude'?{content:[{type:'thinking',thinking:''},{type:'text',text:content}]}:{candidates:[{content:{parts:[{text:content}]}}]};
beforeEach(()=>invoke.mockReset());
afterEach(()=>vi.restoreAllMocks());

it('encodes the Gemini connection key as one query value',async()=>{
  const fetchMock = vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:200}));
  expect((await AIService.testConnection('gemini','dummy&other=value?#fragment')).success).toBe(true);
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect([...url.searchParams.keys()]).toEqual(['key']);
  expect(url.searchParams.get('key')).toBe('dummy&other=value?#fragment');
  expect(url.hash).toBe('');
});

it.each(['openai','claude','gemini'] as const)('generates %s metadata through the hosted provider and preserves source evidence',async provider=>{
  const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(responseFor(provider,JSON.stringify(suggestions))),{status:200}));
  const audit=createAuditFixture({headings:{h1_count:1,h1_texts:['Observed heading'],hierarchy:[],has_valid_hierarchy:true,issues:[]},content_stats:{word_count:10,reading_time_minutes:1,text_ratio_percent:10,top_keywords:[{keyword:'observed',count:2}]}});
  expect(await AIService.generateSuggestions(provider,'dummy-key','',audit,'Keep the evidence')).toEqual(suggestions);
  expect(invoke).not.toHaveBeenCalled();
  const [,options]=fetchMock.mock.calls[0];
  const body=JSON.parse(String(options?.body));
  const prompt=provider==='gemini'?body.contents[0].parts[0].text:body.messages[0].content;
  expect(prompt).toContain('Observed heading');
  expect(prompt).toContain('observed (2)');
  expect(prompt).toContain('Keep the evidence');
  expect(body.model??new URL(String(fetchMock.mock.calls[0][0])).pathname).toContain(provider==='openai'?'gpt-4o':provider==='claude'?'claude-opus-5':'gemini-2.0-flash');
});

it.each(['openai','claude','gemini'] as const)('routes %s CLI metadata without API credentials or forcing an API model',async provider=>{
  const fetchMock=vi.spyOn(globalThis,'fetch');
  invoke.mockResolvedValue('```json\n'+JSON.stringify(suggestions)+'\n```');
  expect(await AIService.generateSuggestions(provider,'','irrelevant-api-model',createAuditFixture(),'Use visible content','local_cli')).toEqual(suggestions);
  expect(invoke).toHaveBeenCalledWith('run_ai_cli',{provider,prompt:expect.stringContaining('Use visible content')});
  expect(invoke.mock.calls[0][1]).not.toHaveProperty('model');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not request hosted suggestions without a configured key',async()=>{
  const fetchMock=vi.spyOn(globalThis,'fetch');
  await expect(AIService.generateSuggestions('openai','  ','model',createAuditFixture())).rejects.toThrow(i18n.t('runtimeErrors.ai.configureKey'));
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  ['openai',401,'authFailed'],['openai',429,'quota'],['openai',503,'apiError'],
  ['claude',401,'authFailed'],['claude',429,'quota'],['claude',503,'apiError'],
  ['gemini',400,'authFailed'],['gemini',403,'authFailed'],['gemini',429,'quota'],['gemini',503,'apiError'],
] as const)('preserves %s suggestion failure HTTP %i as %s',async(provider,status,key)=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('provider unavailable',{status}));
  let failure:unknown;
  try{await AIService.generateSuggestions(provider,'dummy-key','model',createAuditFixture());}catch(error){failure=error;}
  expect(failure).toBeInstanceOf(Error);
  const label=i18n.t(`legacyUi.ai.${provider}`);
  const host=provider==='openai'?'platform.openai.com':provider==='claude'?'console.anthropic.com':'aistudio.google.com';
  expect((failure as Error).message).toBe(i18n.t(`runtimeErrors.ai.${key}`,{provider:label,host,status,detail:'provider unavailable'}));
});

it.each(['openai','claude','gemini'] as const)('rejects malformed %s suggestion responses',async provider=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(responseFor(provider,'{"suggestedTitle":false}')),{status:200}));
  await expect(AIService.generateSuggestions(provider,'dummy-key','model',createAuditFixture())).rejects.toThrow(i18n.t('runtimeErrors.ai.missingSuggestionFields'));
});

it.each(['openai','claude','gemini'] as const)('fails %s connection before network when credentials are missing',async provider=>{
  const fetchMock=vi.spyOn(globalThis,'fetch');
  expect(await AIService.testConnection(provider,'  ')).toEqual({success:false,message:i18n.t('runtimeErrors.ai.keyRequired')});
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  ['openai',200,true,'connected'],['openai',401,false,'invalidKey'],['openai',429,false,'quotaExceeded'],['openai',503,false,'responded'],
  ['claude',200,true,'connected'],['claude',401,false,'invalidKey'],['claude',429,false,'quotaExceeded'],['claude',503,false,'responded'],
  ['gemini',200,true,'connected'],['gemini',400,false,'invalidKey'],['gemini',403,false,'invalidKey'],['gemini',429,false,'quotaExceeded'],['gemini',503,false,'responded'],
] as const)('checks %s connection HTTP %i',async(provider,status,success,key)=>{
  const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status}));
  expect(await AIService.testConnection(provider,'dummy-key')).toEqual({success,message:i18n.t(`runtimeErrors.ai.${key}`,{provider:i18n.t(`legacyUi.ai.${provider}`),status})});
  expect(fetchMock).toHaveBeenCalledOnce();
  const url=String(fetchMock.mock.calls[0][0]);
  expect(url).toContain(provider==='openai'?'api.openai.com/v1/models':provider==='claude'?'api.anthropic.com/v1/messages':'generativelanguage.googleapis.com/v1beta/models');
});

it.each([new Error('connection unavailable'),'connection cancelled'])('returns network failure without claiming a connection: %s',async failure=>{
  vi.spyOn(globalThis,'fetch').mockRejectedValue(failure);
  expect(await AIService.testConnection('openai','dummy-key')).toEqual({success:false,message:i18n.t('runtimeErrors.ai.network',{detail:failure instanceof Error?failure.message:failure})});
});

it.each(['openai','claude','gemini'] as const)('generates %s text through a literal hosted prompt',async provider=>{
  const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(responseFor(provider,'Observed provider answer')),{status:200}));
  const prompt='Literal prompt & $(command) "quoted" — 日本語';
  expect(await AIService.generateText(provider,'dummy-key','selected-model',prompt)).toBe('Observed provider answer');
  const options=fetchMock.mock.calls[0][1];
  const body=JSON.parse(String(options?.body));
  expect(provider==='gemini'?body.contents[0].parts[0].text:body.messages[0].content).toBe(prompt);
});

it.each(['openai','claude','gemini'] as const)('preserves %s hosted text errors',async provider=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('provider unavailable',{status:503}));
  await expect(AIService.generateText(provider,'dummy-key','model','prompt')).rejects.toThrow(i18n.t('runtimeErrors.ai.apiError',{provider:i18n.t(`legacyUi.ai.${provider}`),status:503,detail:'provider unavailable'}));
});

it.each(['openai','claude','gemini'] as const)('returns no invented text for an empty %s provider envelope',async provider=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:200}));
  expect(await AIService.generateText(provider,'dummy-key','model','prompt')).toBe('');
});

it('routes text to an authenticated local CLI without requiring an API key',async()=>{
  const fetchMock=vi.spyOn(globalThis,'fetch');
  invoke.mockResolvedValue('Native CLI answer');
  expect(await AIService.generateText('claude','','ignored-api-model','Literal CLI prompt','local_cli')).toBe('Native CLI answer');
  expect(invoke).toHaveBeenCalledExactlyOnceWith('run_ai_cli',{provider:'claude',prompt:'Literal CLI prompt'});
  expect(fetchMock).not.toHaveBeenCalled();
});
