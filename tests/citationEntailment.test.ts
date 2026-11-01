import { describe, expect, it } from 'vitest';
import { buildEntailmentPrompt, heuristicEntailment, modelEntailment } from '@/services/citationEvidence/entailment';

const SOURCE = 'Statin therapy reduced cardiovascular mortality by 22% in adults over a five year trial.';

describe('heuristicEntailment', () => {
  it.each([
    ['Statin therapy reduced cardiovascular mortality by 22% in adults.', 'consistent'],
    ['Statin therapy reduced cardiovascular mortality by 35% in adults.', 'related'],
    ['Statin therapy did not reduce cardiovascular mortality in adults.', 'contradicts'],
    ['Therapy mortality volcano basalt', 'related'],
    ['Volcano eruptions produce basalt formations.', 'unrelated'],
    ['Statin therapy reduced cardiovascular mortality by 22% in adults.', 'related', 'Statin therapy may reduce cardiovascular mortality by 22% in adults.'],
  ])('%s -> %s', (claim, label, source = SOURCE) => {
    expect(heuristicEntailment(claim, source).label).toBe(label);
  });
  it('is unknown without usable input', () => {
    expect(heuristicEntailment('a b', SOURCE).label).toBe('unknown');
    expect(heuristicEntailment('Statin therapy reduced mortality', '  ').label).toBe('unknown');
  });
  it('handles claims and sources without numbers or word matches', () => {
    expect(heuristicEntailment('Statin therapy reduced mortality', '12,5 9').label).toBe('unrelated');
    expect(heuristicEntailment('Dose 12,5 mg statin therapy', 'Dose 12.5 mg statin therapy').label).toBe('consistent');
  });
});

describe('modelEntailment', () => {
  const claim = 'Statin therapy reduced cardiovascular mortality by 22%.';
  it('uses the model verdict', async () => {
    const result = await modelEntailment({ isConfigured: () => true, generateText: async () => 'Contradicts.' }, claim, SOURCE);
    expect(result).toMatchObject({ label: 'contradicts', method: 'model' });
  });
  it('falls back without a model, on errors and on non-verdicts', async () => {
    const off = await modelEntailment({ isConfigured: () => false, generateText: async () => 'related' }, claim, SOURCE);
    const failing = await modelEntailment({ isConfigured: () => true, generateText: async () => { throw new Error('x'); } }, claim, SOURCE);
    const vague = await modelEntailment({ isConfigured: () => true, generateText: async () => 'maybe' }, claim, SOURCE);
    for (const r of [off, failing, vague]) expect(r).toMatchObject({ label: 'consistent', method: 'heuristic' });
  });
  it('bounds the prompt and flags untrusted data', () => {
    const prompt = buildEntailmentPrompt('c'.repeat(900), 's'.repeat(9000));
    expect(prompt.length).toBeLessThan(3700);
    expect(prompt).toContain('untrusted');
  });
});
