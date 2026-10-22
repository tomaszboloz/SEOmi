import { describe, expect, it } from 'vitest';
import { sanitizeBrief } from '@/services/siteFocusBenchmark/rewriteBrief';

describe('sanitizeBrief markup removal', () => {
  it('cannot rebuild a tag from nested fragments', () => {
    expect(sanitizeBrief('a<scr<script>ipt>alert(1)</scr</script>ipt>b')).not.toMatch(/<|>/);
  });

  it('keeps plain text and strips ordinary tags', () => {
    expect(sanitizeBrief('<b>Bold</b> text')).toBe('Bold text');
  });
});
