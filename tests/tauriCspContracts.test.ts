import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { LOCAL_OLLAMA_URL } from '@/services/embeddingClustering';

const csp = (JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')) as { app: { security: { csp: string } } }).app.security.csp;
const directive = (name: string) => csp.split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `))?.split(/\s+/).slice(1) ?? [];

it('allows plain HTTP only to the loopback Ollama endpoint used by embeddings', () => {
  const connect = directive('connect-src');
  expect(connect).toContain(LOCAL_OLLAMA_URL);
  expect(connect.filter(source => source.startsWith('http:') || source === 'http:' || source === '*')).toEqual([LOCAL_OLLAMA_URL]);
});

it('keeps scripts restricted to the application bundle', () => {
  expect(directive('script-src')).toEqual(["'self'"]);
  expect(directive('default-src')).toEqual(["'self'"]);
});
