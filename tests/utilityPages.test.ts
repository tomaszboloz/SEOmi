import { describe, expect, it } from 'vitest';
import { UTILITY_PATH_PATTERN, UTILITY_SEGMENT_PATTERN } from '@/services/utilityPages';

describe('shared utility page dictionary', () => {
  it.each(['/kariera', '/regulamin-promocji/', '/reklama', '/dla-mediow', '/faq', '/cart', '/pl/rodo', '/privacy-policy', '/404'])('matches %s as a path', (path) => {
    expect(UTILITY_PATH_PATTERN.test(path)).toBe(true);
  });
  it('does not match topical content paths', () => {
    expect(UTILITY_PATH_PATTERN.test('/blog/diabetes-diet')).toBe(false);
    expect(UTILITY_SEGMENT_PATTERN.test('pressure-cooker')).toBe(false);
    expect(UTILITY_SEGMENT_PATTERN.test('career-tips-for-nurses')).toBe(false);
    expect(UTILITY_SEGMENT_PATTERN.test('kariera')).toBe(true);
  });
});
