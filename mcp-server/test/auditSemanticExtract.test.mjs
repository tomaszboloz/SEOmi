import assert from 'node:assert/strict';
import test from 'node:test';
import { extract } from '../dist/auditSemantic.js';

test('public semantic extractor returns only nonempty normalized capture values', () => {
  assert.deepEqual(extract('<h1> Alpha <b>żółć</b> </h1><h1> </h1><h1>Beta\n Gamma</h1>', /<h1>([\s\S]*?)<\/h1>/g), ['Alpha żółć', 'Beta Gamma']);
  assert.deepEqual(extract('nothing matches', /<h1>(.*?)<\/h1>/g), []);
  assert.deepEqual(extract('text', /text/g), []);
});
