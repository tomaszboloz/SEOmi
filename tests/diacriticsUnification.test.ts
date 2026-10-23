import { describe, expect, it } from 'vitest';
import { foldSemanticText, semanticTermKey } from '@/services/semanticText';
import { tokens } from '@/services/topicalAudit/evidence';

describe('unified diacritic folding', () => {
  it('folds German umlauts and sharp s to the same digraphs as semanticTermKey', () => {
    expect(tokens('Größe', 'de')).toEqual(['groesse']);
    expect(tokens('Größe', 'de')[0]).toBe(semanticTermKey('Größe', 'de'));
    expect(foldSemanticText('Größe', 'de-AT')).toBe('groesse');
  });
  it('folds Polish and Spanish without digraphs and matches typed ASCII', () => {
    expect(tokens('Żółć', 'pl')).toEqual(['zolc']);
    expect(tokens('canción', 'es')).toEqual(tokens('cancion', 'es'));
    expect(tokens('Größe')).toEqual(['grosse']);
  });
});
