import { describe, expect, it } from 'vitest';
import { assessAeoReadiness } from '@/services/briefDocument/aeo';
import i18n from '@/i18n';

const message = (key: string, values?: Record<string, unknown>) => i18n.t(`runtimeErrors.contentBrief.${key}`, values);
const words = (count: number) => Array(count).fill('coffee').join(' ');

describe('brief extractability contracts', () => {
  it('reports missing, duplicate and skipped headings and standalone subjects', () => {
    expect(assessAeoReadiness('', 'none').outlineIssues).toEqual([]);
    expect(assessAeoReadiness('Plain lead.', 'none').outlineIssues).toEqual([message('outlineMissingH1')]);
    const result = assessAeoReadiness('# One\n# Two\n### Skipped\n\nThis is a subject.\n\nCoffee stands alone.', 'none');
    expect(result.outlineIssues).toEqual([message('outlineMultipleH1', { count: 2 }), message('outlineJump', { previous: 1, level: 3 })]);
    expect(result.components.standalone).toBe(5);
    expect(result.recommendations).toContain(message('nameTopic', { count: 1 }));
  });

  it('requires an immediate short paragraph after each question heading', () => {
    const draft = `# Guide\n\nCoffee is a drink.\n\n## How brew?\n\n${words(51)}\n\n## Which tool?\n- Grinder\n\n## Why grind?\n\nShort direct answer.\n\n## When?`;
    const result = assessAeoReadiness(draft, 'faq', ['Article', 'Article']);
    expect(result).toMatchObject({ questionHeadings: 4, answeredQuestionHeadings: 1, schemaTypesObserved: ['Article'] });
    expect(result.components.questionAnswers).toBe(8);
    expect(result.recommendations).toContain(message('directAnswer', { heading: 'How brew?' }));
    expect(result.recommendations).toContain(message('directAnswer', { heading: 'When?' }));
  });

  it('scores target formats separately and warns when a requested format is absent', () => {
    const lead = '# Guide\n\nCoffee is a drink.';
    const cases = [
      ['none', lead], ['definition', lead], ['list', `${lead}\n\n- Beans`],
      ['table', `${lead}\n\n| Beans | Water |`], ['steps', `${lead}\n\n1. Grind`],
      ['faq', `${lead}\n\n## How brew?\n\nGrind beans.`],
    ] as const;
    for (const [target, markdown] of cases) expect(assessAeoReadiness(markdown, target).components.summary).toBe(10);
    for (const target of ['definition', 'list', 'table', 'steps', 'faq'] as const) {
      const result = assessAeoReadiness('# Guide\n\nBrew carefully.', target);
      expect(result.components.summary).toBe(0);
      expect(result.recommendations).toContain(message('targetFormat'));
    }
    const long = assessAeoReadiness(`# Guide\n\nCoffee is ${words(60)}.`, 'definition');
    expect(long.components.definition).toBe(0);
    expect(long.recommendations).toContain(message('summary'));
    expect(long.recommendations).toContain(message('definitionRecommendation'));
  });

  it('uses median answer sentence length for brevity thresholds', () => {
    for (const [count, expected] of [[25, 10], [26, 5], [32, 5], [33, 0]]) {
      const result = assessAeoReadiness(`# Guide\n\n## How brew?\n\n${words(count)}.`, 'faq');
      expect(result.components.brevity).toBe(expected);
      expect(result.recommendations.includes(message('shortenAnswers'))).toBe(count > 25);
    }
    const empty = assessAeoReadiness('', 'none');
    expect(empty.components).toMatchObject({ brevity: 5, standalone: 10, questionAnswers: 15, schemaSignal: 0 });
    for (const key of ['questionHeadings', 'listOrTable', 'schemaMissing']) expect(empty.recommendations).toContain(message(key));
    const median = assessAeoReadiness(`# Guide\n\n## How?\n\n${words(33)}. ${words(5)}.\n\n## Why?\n\n${words(26)}.`, 'faq');
    expect(median.components.brevity).toBe(5);
  });
});
