import { describe, expect, it } from 'vitest';
import { briefText, evidenceTokens, extractDraftParagraphs, isHttpSourceUrl, normalize, normalizeHttpUrl } from '@/services/briefDocument/primitives';
import { isQuestionHeading, markdownBlocks, scoreSections, scoreWords, sentenceLengths, stripFrontMatter } from '@/services/briefDocument/markdown';
import { bestBriefSentenceMatch, briefSentenceSpans } from '@/services/briefDocument/sentences';
import i18n from '@/i18n';

describe('brief text and Markdown contracts', () => {
  it('normalizes Unicode and whitespace and preserves unavailable URL identities as empty', () => {
    expect(normalize(' ＣＯＦＦＥＥ \n Beans ')).toBe('coffee beans');
    for (const value of [undefined, null, '', '  ']) expect(normalizeHttpUrl(value)).toBe('');
    expect(normalizeHttpUrl(' https://EXAMPLE.test/path#part ')).toBe('https://example.test/path');
    expect(normalizeHttpUrl(' ftp://example.test ')).toBe('ftp://example.test');
    expect(normalizeHttpUrl(' not a URL ')).toBe('not a URL');
    expect(isHttpSourceUrl('https://example.test')).toBe(true);
    expect(isHttpSourceUrl('http://example.test')).toBe(true);
    expect(isHttpSourceUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpSourceUrl('not a URL')).toBe(false);
    expect(briefText('wordFloor', { count: 2, floor: 8 })).toBe(i18n.t('runtimeErrors.contentBrief.wordFloor', { count: 2, floor: 8 }));
  });

  it('deduplicates evidence terms, strips stopwords and splits nonempty paragraphs', () => {
    expect(evidenceTokens('THE coffee Coffee ＢＥＡＮＳ oraz 42 espresso!')).toEqual(['coffee', 'beans', 'espresso']);
    expect(extractDraftParagraphs(' First \r\n\r\n Second \n \n')).toEqual(['First', 'Second']);
    expect(extractDraftParagraphs(' ')).toEqual([]);
  });

  it('parses heading levels, paragraphs, ordered/unordered lists and tables without front matter', () => {
    const draft = '---\ntitle: Hidden\n---\n# Guide\n\nLead\ncontinued\n## Details\n### Deep\n#### Deeper\n- Item\n1. Step\n| A | B |\n\nEnd';
    expect(stripFrontMatter(draft)).toBe(draft.slice(draft.indexOf('# Guide')));
    expect(stripFrontMatter('---\nunfinished')).toBe('---\nunfinished');
    expect(markdownBlocks(draft)).toEqual([
      { kind: 'h1', text: 'Guide' }, { kind: 'paragraph', text: 'Lead continued' },
      { kind: 'h2', text: 'Details' }, { kind: 'h3', text: 'Deep' }, { kind: 'h3', text: 'Deeper' },
      { kind: 'list', text: 'Item' }, { kind: 'list', text: 'Step' },
      { kind: 'table', text: '| A | B |' }, { kind: 'paragraph', text: 'End' },
    ]);
    expect(markdownBlocks('')).toEqual([]);
    expect(scoreSections('Intro\n## One\nBody\n## Two')).toEqual([
      { heading: 'One', body: '\nBody\n' }, { heading: 'Two', body: '' },
    ]);
    expect(scoreSections('No sections')).toEqual([]);
    expect(scoreWords("Zażółć coffee-beans don't 12_34")).toBe(4);
    expect(scoreWords('!?')).toBe(0);
    expect(isQuestionHeading('Technical overview?')).toBe(true);
    expect(isQuestionHeading('  Jak działa proces  ')).toBe(true);
    expect(isQuestionHeading('Overview')).toBe(false);
    expect(sentenceLengths('One two. Three! ')).toEqual([2, 1]);
  });

  it('keeps source and response offsets in the original text and caps candidate sentences at thirty', () => {
    const text = '😀!  Coffee beans roasted.\nA B.   \nGrinder brewing recipe';
    const spans = briefSentenceSpans(text);
    expect(spans.map((span) => text.slice(span.start, span.end))).toEqual(['Coffee beans roasted', 'Grinder brewing recipe']);
    expect(spans[0].start).toBe(text.indexOf('Coffee'));
    expect(briefSentenceSpans('coffee beans roasted. '.repeat(31))).toHaveLength(30);
  });

  it('chooses the best sentence, retains the first equal match and rejects weak/empty evidence', () => {
    const paragraph = 'coffee beans roasted grinder brewing';
    const partial = 'coffee beans roasted extra';
    const exact = 'coffee beans roasted grinder brewing';
    expect(bestBriefSentenceMatch(paragraph, ['', 'unrelated', partial, exact, exact]))
      .toMatchObject({ text: paragraph, excerpt: exact, overlap: 1, matchedTerms: paragraph.split(' ') });
    expect(bestBriefSentenceMatch('coffee beans roasted', ['coffee beans', ''])).toBeNull();
    expect(bestBriefSentenceMatch('coffee beans roasted', [`coffee beans roasted ${'extra '.repeat(1)}${Array.from({ length: 20 }, (_, i) => `other${i}`).join(' ')}`])).toBeNull();
    expect(bestBriefSentenceMatch('', ['coffee beans roasted'])).toBeNull();
    const many = Array.from({ length: 20 }, (_, index) => `concept${index}`).join(' ');
    expect(bestBriefSentenceMatch(many, [many])?.matchedTerms).toHaveLength(12);
  });
});
