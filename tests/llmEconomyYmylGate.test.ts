import { describe, expect, it } from 'vitest';
import { validateYmylClaim } from '@/services/llmEconomy/factGate';

describe('validateYmylClaim source gate', () => {
  const verifiedSource = [
    'Standard dose of ibuprofen is 200 mg up to 400 mg.',
    'Maximum daily fee is 150 PLN, with a 5% late penalty.',
  ];

  it('rejects unsupported medical dosages and financial claims', () => {
    const invalidText = 'Take 800 mg right now. Total fee is 500 PLN.';
    const validation = validateYmylClaim(invalidText, verifiedSource);
    expect(validation.allowed).toBe(false);
    expect(validation.reason).toBe('unsupported-value');
    expect(validation.rejectedValues).toContain('800mg');
    expect(validation.rejectedValues).toContain('500pln');
    expect(validation.needsHumanApproval).toBe(true);
  });

  it('rejects all numeric claims when no source is available', () => {
    const text = 'Recommended daily dose is 200 mg.';
    const validation = validateYmylClaim(text, []);
    expect(validation.allowed).toBe(false);
    expect(validation.reason).toBe('no-source');
    expect(validation.rejectedValues).toEqual(['200mg']);
    expect(validation.needsHumanApproval).toBe(true);
  });

  it('allows claims strictly verified by source text, but mandates human approval', () => {
    const validText = 'Standard dose of ibuprofen is 200 mg. Late fee is 5%.';
    const validation = validateYmylClaim(validText, verifiedSource);
    expect(validation.allowed).toBe(true);
    expect(validation.rejectedValues).toEqual([]);
    expect(validation.needsHumanApproval).toBe(true);
  });

  it('allows non-numeric prose but still enforces human approval for CMS', () => {
    const generalText = 'Consult your physician before taking any medication.';
    const validation = validateYmylClaim(generalText, []);
    expect(validation.allowed).toBe(true);
    expect(validation.rejectedValues).toEqual([]);
    expect(validation.needsHumanApproval).toBe(true);
  });
});
