import { describe, expect, it } from 'vitest';
import { extractValues, gateFacts, mentionedTerms, parseTermDictionary, sentencesOf, validateYmylClaim } from '@/services/llmEconomy';

const dict = parseTermDictionary('# drugs\nParacetamol\nIbuprofen;NLPZ\n"E11","Cukrzyca typu 2"\n1\n5\nx\n', 'user-list.csv', '2026-10-30').dictionary!;

describe('YMYL fact gate with an imported term dictionary (#137)', () => {
  it('parses lists and CSV cells, skipping comments, numbers and one-letter cells', () => {
    const parsed = parseTermDictionary('﻿a\nParacetamol, ibuprofen\n12,5\n', 's', 't');
    expect([...(parsed.dictionary?.terms ?? [])]).toEqual(['paracetamol', 'ibuprofen']);
    expect(parsed.rejected).toBe(3);
    expect(parseTermDictionary('# only comments\n\n', 's', 't').dictionary).toBeNull();
    expect(dict).toMatchObject({ source: 'user-list.csv', importedAt: '2026-10-30' });
    expect(parseTermDictionary(Array.from({ length: 20_001 }, (_, i) => `t${i}`).join('\n'), 's', 't').truncated).toBe(true);
  });

  it('finds single-word, phrase and code terms', () => {
    expect(mentionedTerms('Przy cukrzycy typu 2 (E11.) podaje się paracetamol.', dict).sort()).toEqual(['e11', 'paracetamol']);
    expect(mentionedTerms('Cukrzyca typu 2 to choroba.', dict)).toEqual(['cukrzyca typu 2']);
  });

  it('rejects a real value attributed to the wrong drug', () => {
    const sources = ['Ibuprofen: 400 mg co 6 godzin.', 'Paracetamol 500 mg do 4 razy na dobę.'];
    const gate = gateFacts('Paracetamol 400 mg co 6 godzin. Ibuprofen 400 mg co 6 godzin.', sources, dict);
    expect(gate.rejected).toEqual([{ sentence: 'Paracetamol 400 mg co 6 godzin.', reason: 'value-not-bound-to-term', values: ['400mg'] }]);
    expect(gate.accepted).toEqual(['Ibuprofen 400 mg co 6 godzin.']);
    expect(gateFacts('Paracetamol 400 mg co 6 godzin.', sources).rejected).toEqual([]);
  });

  it('keeps fabricated values and missing sources as before and applies terms in validateYmylClaim', () => {
    expect(gateFacts('Paracetamol 750 mg.', ['Paracetamol 500 mg.'], dict).rejected[0].reason).toBe('unsupported-value');
    expect(gateFacts('Paracetamol 750 mg.', [], dict).rejected[0].reason).toBe('no-source');
    expect(gateFacts('Paracetamol działa przeciwbólowo. Dawka 500 mg.', ['Paracetamol 500 mg.'], dict).rejected).toEqual([]);
    const check = validateYmylClaim('Paracetamol 400 mg.', ['Ibuprofen 400 mg.'], dict);
    expect(check).toMatchObject({ allowed: false, reason: 'value-not-bound-to-term', rejectedValues: ['400mg'], needsHumanApproval: true });
    expect(validateYmylClaim('Paracetamol 400 mg.', ['Ibuprofen 400 mg.']).allowed).toBe(true);
  });

  it('keeps the shared value and sentence helpers stable', () => {
    expect(extractValues('2,5% i 100 PLN')).toEqual(['2.5%', '100pln']);
    expect(sentencesOf('Dawka 2.5 mg. Koniec!')).toEqual(['Dawka 2.5 mg.', 'Koniec!']);
  });
});
