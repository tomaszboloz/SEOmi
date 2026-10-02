import type { TopicalContentBrief } from '@/services/topicalMap';
import type { AeoReadinessAssessment } from './types';
import { briefText } from './primitives';
import { markdownBlocks, scoreWords, isQuestionHeading, sentenceLengths, stripFrontMatter } from './markdown';

const DANGLING_START = /^(?:this|that|it|these|those|they|he|she|the former|the latter|to|ten|ta|taki|taka|takie|one|oni|ona|ono|jego|jej|ich|powyższy|powyższa|powyższe)\b/i;

/** Deterministic extractability signals; schema presence is not schema validation or evidence of AI citations. */
export const assessAeoReadiness = (markdown: string, snippetTarget: TopicalContentBrief['snippetTarget'], schemaTypesObserved: string[] = []): AeoReadinessAssessment => {
  const blocks = markdownBlocks(markdown);
  const paragraphs = blocks.filter((block) => block.kind === 'paragraph');
  const headingLevels = blocks.filter((block) => block.kind === 'h1' || block.kind === 'h2' || block.kind === 'h3').map((block) => block.kind === 'h1' ? 1 : block.kind === 'h2' ? 2 : 3);
  const outlineIssues: string[] = [];
  const h1Count = headingLevels.filter((level) => level === 1).length;
  if (blocks.length > 0 && h1Count === 0) outlineIssues.push(briefText('outlineMissingH1'));
  if (h1Count > 1) outlineIssues.push(briefText('outlineMultipleH1', { count: h1Count }));
  headingLevels.forEach((level, index) => {
    const previous = headingLevels[index - 1];
    if (previous !== undefined && level > previous + 1) outlineIssues.push(briefText('outlineJump', { previous, level }));
  });
  const lead = paragraphs[0]?.text ?? '';
  const definition = /\b(is|are|means|refers to|jest|są|oznacza|to\s+rodzaj|definiuje się jako)\b/i.test(lead) && scoreWords(lead) <= 55 ? 15 : 0;
  const recommendations: string[] = [];
  if (!definition) recommendations.push(briefText('definitionRecommendation'));
  let questionHeadings = 0;
  let answeredQuestionHeadings = 0;
  const answerSentences: number[] = [];
  blocks.forEach((block, index) => {
    if (block.kind !== 'h2' || !isQuestionHeading(block.text)) return;
    questionHeadings += 1;
    const next = blocks[index + 1];
    if (next?.kind === 'paragraph' && scoreWords(next.text) <= 50) {
      answeredQuestionHeadings += 1;
      answerSentences.push(...sentenceLengths(next.text));
    } else recommendations.push(briefText('directAnswer', { heading: block.text }));
  });
  const questionAnswers = questionHeadings ? Math.round(30 * answeredQuestionHeadings / questionHeadings) : 15;
  if (!questionHeadings) recommendations.push(briefText('questionHeadings'));
  const hasList = blocks.some((block) => block.kind === 'list');
  const hasTable = blocks.some((block) => block.kind === 'table');
  const structure = (hasList ? 8 : 0) + (hasTable ? 7 : 0);
  if (!hasList && !hasTable) recommendations.push(briefText('listOrTable'));
  const firstBlocks = blocks.slice(0, 4);
  const summaryPresent = firstBlocks.some((block) => block.kind === 'paragraph' && scoreWords(block.text) <= 60);
  const targetFormatPresent = snippetTarget === 'none'
    || snippetTarget === 'definition' && definition > 0
    || snippetTarget === 'list' && hasList
    || snippetTarget === 'table' && hasTable
    || snippetTarget === 'steps' && /^\s*\d+[.)]\s/m.test(stripFrontMatter(markdown))
    || snippetTarget === 'faq' && questionHeadings > 0;
  const summary = summaryPresent && targetFormatPresent ? 10 : 0;
  if (!summaryPresent) recommendations.push(briefText('summary'));
  if (summaryPresent && !targetFormatPresent) recommendations.push(briefText('targetFormat'));
  const medianAnswerLength = answerSentences.length ? [...answerSentences].sort((a, b) => a - b)[Math.floor((answerSentences.length - 1) / 2)] : null;
  const brevity = medianAnswerLength === null ? 5 : medianAnswerLength <= 25 ? 10 : medianAnswerLength <= 32 ? 5 : 0;
  if (medianAnswerLength !== null && medianAnswerLength > 25) recommendations.push(briefText('shortenAnswers'));
  const paragraphsWithDanglingSubjects = paragraphs.filter((block) => DANGLING_START.test(block.text)).length;
  const standalone = paragraphs.length ? Math.round(10 * (1 - paragraphsWithDanglingSubjects / paragraphs.length)) : 10;
  if (paragraphsWithDanglingSubjects) recommendations.push(briefText('nameTopic', { count: paragraphsWithDanglingSubjects }));
  const schemaSignal = schemaTypesObserved.length ? 10 : 0;
  if (!schemaSignal) recommendations.push(briefText('schemaMissing'));
  return {
    score: definition + questionAnswers + summary + structure + brevity + standalone + schemaSignal,
    components: { definition, questionAnswers, summary, structure, brevity, standalone, schemaSignal },
    questionHeadings, answeredQuestionHeadings, schemaTypesObserved: [...new Set(schemaTypesObserved)], outlineIssues, recommendations,
    methodology: briefText('aeoMethodology'),
  };
};
