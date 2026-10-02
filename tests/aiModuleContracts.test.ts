import { afterEach, expect, it, vi } from 'vitest';
import { aiProviderLabel } from '@/services/ai/labels';
import { buildAiPrompt } from '@/services/ai/prompt';
import { callOpenAI, callClaude, callGemini } from '@/services/ai/suggestions';
import { generateAiText } from '@/services/ai/text';
import { testAiConnection } from '@/services/ai/connection';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';
afterEach(()=>vi.restoreAllMocks());
const suggestion={suggestedTitle:'Observed title',suggestedDescription:'Observed description',keyImprovements:['Use evidence']};
it('uses localized names for each supported provider',()=>{
 expect(aiProviderLabel('openai')).toBe(i18n.t('legacyUi.ai.openai'));expect(aiProviderLabel('claude')).toBe(i18n.t('legacyUi.ai.claude'));expect(aiProviderLabel('gemini')).toBe(i18n.t('legacyUi.ai.gemini'));
});
it('builds a prompt from actual source observations and literal user instructions',()=>{
 const prompt=buildAiPrompt(createAuditFixture({meta_tags:{title:'Observed title',title_length:14,description:'Observed description',description_length:20,other_tags:[]}}),'Literal "instruction"');
 expect(prompt).toContain('Observed title');expect(prompt).toContain('Observed description');expect(prompt).toContain('Literal "instruction"');
 const empty=buildAiPrompt(createAuditFixture());expect(empty).toContain('(missing)');expect(empty).toContain('None');expect(empty).not.toContain('User Specific Instruction');
});
it('calls the OpenAI suggestion contract with a structured response format',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(suggestion)}}]})));
 expect(await callOpenAI('dummy-key','selected-model','literal prompt')).toEqual(suggestion);
 const body=JSON.parse(String(fetch.mock.calls[0][1]?.body));expect(body.response_format).toEqual({type:'json_object'});expect(body.model).toBe('selected-model');
});
it('calls the Claude suggestion contract and preserves its selected model',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(suggestion)}]})));
 expect(await callClaude('dummy-key','selected-model','literal prompt')).toEqual(suggestion);
 const body=JSON.parse(String(fetch.mock.calls[0][1]?.body));expect(body.model).toBe('selected-model');expect(body.max_tokens).toBe(16000);expect(body.fallbacks).toBeUndefined();expect(body.messages[0].content).toBe('literal prompt');
});
it('encodes Gemini model/key values and requires a JSON suggestion response',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(suggestion)}]}}]})));
 expect(await callGemini('dummy&value','model/name','literal prompt')).toEqual(suggestion);
 const url=new URL(String(fetch.mock.calls[0][0]));expect(url.pathname).toContain('model%2Fname');expect(url.searchParams.get('key')).toBe('dummy&value');
 expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).generationConfig).toEqual({responseMimeType:'application/json'});
});
it('does not invoke hosted text transport without credentials',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch');await expect(generateAiText('openai',' ','model','prompt')).rejects.toThrow(i18n.t('runtimeErrors.ai.credentialMissing',{provider:aiProviderLabel('openai')}));expect(fetch).not.toHaveBeenCalled();
});
it('returns unavailable connection evidence for network failures',async()=>{
 vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('actual network failure'));
 expect(await testAiConnection('gemini','dummy-key')).toEqual({success:false,message:i18n.t('runtimeErrors.ai.network',{detail:'actual network failure'})});
});
