import { describe, expect, it } from 'vitest';
import { FOCUS_RING, LAYERS, LEVEL_BAR, LEVEL_TEXT, SEVERITY_TEXT, levelOfScore } from '@/components/Domain/crawlResults/trust/trustHelpers';

describe('trustHelpers', () => {
  it('maps scores to levels at every boundary', () => {
    expect(levelOfScore(100)).toBe('strong');
    expect(levelOfScore(75)).toBe('strong');
    expect(levelOfScore(74.9)).toBe('adequate');
    expect(levelOfScore(60)).toBe('adequate');
    expect(levelOfScore(59)).toBe('weak');
    expect(levelOfScore(40)).toBe('weak');
    expect(levelOfScore(39)).toBe('critical');
    expect(levelOfScore(0)).toBe('critical');
  });

  it('defines a style for every level and severity', () => {
    const levels = ['strong', 'adequate', 'weak', 'critical'] as const;
    levels.forEach((level) => {
      expect(LEVEL_BAR[level]).toMatch(/^bg-/);
      expect(LEVEL_TEXT[level]).toMatch(/^text-/);
    });
    expect(Object.keys(SEVERITY_TEXT).sort()).toEqual(['critical', 'info', 'warning']);
  });

  it('lists the four trust layers with matching help ids', () => {
    expect(LAYERS.map((l) => l.layer)).toEqual(['schemaGraph', 'authorAlignment', 'citationQuality', 'transparency']);
    LAYERS.forEach((l) => expect(l.help).toBe(`trust.${l.layer}`));
    expect(FOCUS_RING).toContain('focus-visible:ring-2');
  });
});
