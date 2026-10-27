import { describe, expect, it } from 'vitest';
import { compareRewrite, profileRewrite } from '@/services/aioReadiness';
import { rulesFor, scoreChunk } from '@/services/aioReadiness';
import { tokenCount } from '@/services/aioReadiness/text';

describe('AIO rewrite review uses the active core profile', () => {
  const options = { language: 'en', market: 'PL', coreTerms: ['CGM sensor'] };

  it('uses the same scoreChunk result and versioned profile for before and after', () => {
    const text = 'A CGM sensor lasts 10 days.';
    const rules = rulesFor('en').rules;
    const core = scoreChunk({ heading: 'CGM sensor', level: 2, paragraphs: [text], tokens: tokenCount(text, rules.charBased), windowIndex: 0, coreTerms: options.coreTerms }, rules);
    const profile = profileRewrite(text, 'CGM sensor', options);
    const comparison = compareRewrite(text, 'A CGM sensor lasts 14 days.', 'CGM sensor', options);

    expect(profile.score).toBe(core.score);
    expect(profile.selfContainment).toBe(Math.round(core.selfContainment * 100));
    expect(profile.factCount).toBe(core.triples);
    expect(comparison.before.profile).toMatchObject({ id: 'aio-r', algorithmVersion: expect.stringContaining('aio-r-'), configHash: expect.any(String), market: 'PL' });
    expect(comparison.before.profile).toEqual(comparison.after.profile);
    expect(comparison.delta).toBeTypeOf('number');
  });

  it('keeps absent input unscored instead of inventing zero', () => {
    const profile = profileRewrite('', 'CGM sensor', options);
    const comparison = compareRewrite('', 'A CGM sensor lasts 10 days.', 'CGM sensor', options);

    expect(profile.score).toBeNull();
    expect(profile.availability).toBe('unavailable');
    expect(profile.unknownReasons).toContain('input-unavailable');
    expect(comparison.delta).toBeNull();
  });

  it('keeps partial language and unknown-anchor evidence explicit', () => {
    const language = profileRewrite('Sensor lasts 10 days.', '', { language: 'xx' });
    const anchor = profileRewrite('Sensor lasts 10 days.', '', { language: 'en' });

    expect(language.score).not.toBeNull();
    expect(language.availability).toBe('partial');
    expect(language.unknownReasons).toContain('language-rules-unsupported; lexical signals remain partial');
    expect(anchor.unknownReasons).toContain('core-anchor-not-supplied; no-entity contribution is unknown');
  });
});
