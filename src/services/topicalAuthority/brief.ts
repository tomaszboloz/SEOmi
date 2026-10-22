import { topicCoverageRatio } from './coverage';
import { simulateTas } from './score';
import type { GapLevel, SubtopicCoverage, TopicalAuthorityReport } from './types';

export interface GapBrief {
  subtopicId: string;
  label: string;
  level: GapLevel;
  /** Market importance 0-100. */
  weight: number;
  suggestedPath: string;
  h1: string;
  /** Entity Checklist: terms every leading page uses. */
  entities: string[];
  questions: string[];
  /** Pillar-mate page that should link to the new article. */
  linkFrom?: string;
  /** Pillar-mate page the new article should link to. */
  linkTo?: string;
  /** Simulated TAS gain from this single article. */
  impact: number;
}

const slug = (text: string): string => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
const round1 = (value: number): number => Math.round(value * 10) / 10;
const sentence = (text: string): string => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);

/** Architectural brief for a missing sub-topic: URL, H1, entity checklist, user questions and silo links. */
export const buildGapBrief = (report: TopicalAuthorityReport, row: SubtopicCoverage): GapBrief => {
  const taxonomy = report.taxonomy;
  const pillarLabel = taxonomy?.pillars.find((pillar) => pillar.id === row.pillar)?.label ?? row.pillar;
  const reference = taxonomy?.subtopics.find((item) => item.id === row.subtopicId);
  const mates = report.coverage.filter((item) => item.pillar === row.pillar && item.coverage > 0 && item.bestUrl)
    .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0) || b.similarity - a.similarity);
  const fixed = report.coverage.map((item) => (item === row ? { ...item, coverage: 1 as const } : item));
  const before = simulateTas(report.pillars, report.sfs);
  const after = simulateTas({ ...report.pillars, tcr: topicCoverageRatio(fixed) }, report.sfs);
  return {
    subtopicId: row.subtopicId, label: row.label, level: row.gap ?? 'medium', weight: Math.round(row.importance * 100),
    suggestedPath: row.pillar === 'general' ? `/${slug(row.label)}` : `/${slug(pillarLabel)}/${slug(row.label)}`,
    h1: sentence(row.label), entities: reference?.entities ?? row.entitiesMissing, questions: reference?.questions ?? row.questionsMissing,
    ...(mates[0]?.bestUrl ? { linkFrom: mates[0].bestUrl } : {}), ...(mates[1]?.bestUrl ? { linkTo: mates[1].bestUrl } : {}),
    impact: before === null || after === null ? 0 : round1(Math.max(0, after - before)),
  };
};

/** Prompt for the connected AI provider: a content brief that works the entity checklist into a real outline. */
export const buildAuthorityPrompt = (brief: GapBrief, coreLabel: string, language: string): string => [
  `Write a content brief in language "${language || 'en'}" for a new article on the topic "${brief.label}" within the topic area "${coreLabel}".`,
  `Suggested H1: ${brief.h1}.`,
  brief.entities.length ? `Cover these entities and attributes: ${brief.entities.join(', ')}.` : '',
  brief.questions.length ? `Answer these user questions under their own headings: ${brief.questions.join(' | ')}.` : '',
  'Deliver: a working title, a meta description, an H2/H3 outline, one factual data point to research per section, and internal link anchor ideas. Plain text, no markdown fences.',
].filter(Boolean).join('\n');
