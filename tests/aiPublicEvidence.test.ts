import {expect,it} from 'vitest';
import {emptyAiResearchSettings,citesOwnDomain,mentionOffset,aiSearchMode} from '@/services/aiResearchEvidence';

it('creates independent AI research defaults without carrying inputs across projects',()=>{
  const first=emptyAiResearchSettings();first.prompts.push('private input');first.competitors.push('private competitor');first.repetitions=5;
  expect(emptyAiResearchSettings()).toEqual({prompts:[],competitors:[],repetitions:1});
});

it('accepts only the own domain or its subdomains as citations rather than lookalike hosts',()=>{
  expect(citesOwnDomain(['https://example.com/page'],'https://www.example.com/')).toBe(true);
  expect(citesOwnDomain(['https://shop.example.com/page'],'example.com')).toBe(true);
  expect(citesOwnDomain(['https://example.com.evil.test'],'example.com')).toBe(false);
  expect(citesOwnDomain(['https://notexample.com'],'example.com')).toBe(false);
  expect(citesOwnDomain(['https://example.com'],'')).toBe(false);
  expect(citesOwnDomain(['not a URL'],'example.com')).toBe(false);
});

it('matches complete Unicode brand names and escaped punctuation rather than embedded substrings',()=>{
  expect(mentionOffset('SEOmi supports SEO','SEO')).toBe(15);
  expect(mentionOffset('SEOmi','SEO')).toBe(-1);
  expect(mentionOffset('  ŻÓŁĆ is present','żółć')).toBe(2);
  expect(mentionOffset('A C++ mention','C++')).toBe(2);
  expect(mentionOffset('fullwidth ＳＥＯｍｉ','SEOmi')).toBe(10);
  expect(mentionOffset('anything',' ')).toBe(-1);
});

it('declares provider search capability without inventing web evidence',()=>{
  expect(aiSearchMode('claude')).toBe('web_enabled');
  expect(aiSearchMode('openai')).toBe('model_knowledge');
  expect(aiSearchMode('gemini')).toBe('model_knowledge');
});
