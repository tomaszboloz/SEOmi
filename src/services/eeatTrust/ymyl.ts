import type { SiteFocusReport } from '@/services/siteFocus';
import type { SchemaNode } from './graph';
import type { YmylCategory } from './types';

/** Stems of Your-Money-Or-Your-Life vocabulary across the supported languages (matched on the Core Topic and page titles). */
const LEXICON: Record<YmylCategory, RegExp> = {
  health: /(health|medic|medyc|zdrow|lekar|leki|choro|cukrzyc|diabet|insulin|therap|terapi|clinic|klinik|symptom|objaw|doctor|salud|m[eé]dic|sant[eé]|gesundheit|arzt|krankheit|salute|medico|sa[uú]de|m[eé]dico|здоров|врач|лекарств|医|健康|病|건강|의료|질병|صح|طب)/i,
  finance: /(financ|finans|kredyt|credit|loan|pożyczk|pozyczk|invest|inwest|mortgage|hipotec|ubezpiecz|insurance|seguro|versicherung|assurance|assicura|banco|bank|giełd|gield|tax|podat|pension|emerytur|préstamo|darlehen|prêt|prestito|empréstimo|кредит|инвест|налог|金融|投资|税|투자|금융|قرض|استثمار)/i,
  legal: /(legal|prawn|prawo|law\b|lawyer|adwokat|radca|court|sąd|umowa|contract|divorce|rozwód|rozwod|inheritance|spadek|derecho|abogad|recht|anwalt|droit|avocat|diritto|avvocato|direito|advogado|закон|юрист|суд|法律|律师|법률|변호|قانون|محام)/i,
};

const SCHEMA_HINT: Array<[RegExp, YmylCategory]> = [
  [/Medical|Physician|Hospital|Drug|Health/i, 'health'],
  [/Financial|BankAccount|LoanOrCredit|InvestmentOrDeposit|InsuranceAgency/i, 'finance'],
  [/Attorney|LegalService|Notary|Legislation/i, 'legal'],
];

const TITLE_MIN_HITS = 3;
const TITLE_MIN_SHARE = 0.3;
/** Equals the detection threshold: a title corpus dominated by YMYL vocabulary decides alone. */
const TITLE_BUMP = 3;

/** YMYL category of the site from schema types first, then the Core Topic and strongest titles. Undefined when none fits. */
export const detectYmyl = (nodes: SchemaNode[], report: SiteFocusReport | undefined, titles: string[]): YmylCategory | undefined => {
  const counts = new Map<YmylCategory, number>();
  const bump = (category: YmylCategory, by: number): void => { counts.set(category, (counts.get(category) ?? 0) + by); };
  for (const node of nodes) for (const type of node.types) for (const [pattern, category] of SCHEMA_HINT) if (pattern.test(type)) bump(category, 3);
  const topic = [report?.coreTopic.label ?? '', ...(report?.coreTopic.terms.map((term) => term.term) ?? [])].join(' ');
  for (const category of Object.keys(LEXICON) as YmylCategory[]) {
    if (LEXICON[category].test(topic)) bump(category, 4);
    // Document frequency over every article title (repeated cores included): enough pages, enough share.
    const hits = titles.filter((title) => LEXICON[category].test(title)).length;
    const share = hits / Math.max(1, titles.length);
    bump(category, hits >= TITLE_MIN_HITS && share >= TITLE_MIN_SHARE ? TITLE_BUMP : share);
  }
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 3 ? best[0] : undefined;
};

/**
 * Per-category applicability (profile decision, #65 D01): the claim gate applies to every YMYL category;
 * a named reviewer is expected for health and finance content, not for legal commentary.
 */
export const YMYL_APPLICABILITY: Record<YmylCategory, { reviewer: boolean; claimGate: boolean }> = {
  health: { reviewer: true, claimGate: true },
  finance: { reviewer: true, claimGate: true },
  legal: { reviewer: false, claimGate: true },
};
export const reviewerApplicable = (category: YmylCategory): boolean => YMYL_APPLICABILITY[category].reviewer;

export const YMYL_SEVERE_MULTIPLIER = 0.45;
export const YMYL_MODERATE_MULTIPLIER = 0.65;

export interface YmylGateInput { category: YmylCategory; authorScore?: number; citationScore?: number; rBacked?: number; claimCount?: number; articlesWithReviewer: number; articleCount: number }
export interface YmylGate { multiplier: number; tier: 'none' | 'moderate' | 'severe'; reasons: string[]; claimGate: boolean }

/**
 * Tiered YMYL penalty. Severe (.45): author alignment 0, citation score under 15, or claim gate with
 * R_backed under .25. Moderate (.65): citation under 30, R_backed under .5, or an expected reviewer missing.
 * Unknown values never trigger; the claim gate needs observed claims.
 */
export const ymylGate = (input: YmylGateInput): YmylGate => {
  const rule = YMYL_APPLICABILITY[input.category];
  const claimGate = rule.claimGate && (input.claimCount ?? 0) > 0 && input.rBacked !== undefined;
  const rBacked = input.rBacked ?? 1;
  const severe: string[] = [];
  const moderate: string[] = [];
  if (input.authorScore === 0) severe.push('author-zero');
  if (input.citationScore !== undefined && input.citationScore < 15) severe.push('citation-below-15');
  if (claimGate && rBacked < 0.25) severe.push('claims-unbacked');
  if (input.citationScore !== undefined && input.citationScore < 30) moderate.push('citation-below-30');
  if (claimGate && rBacked < 0.5) moderate.push('claims-weakly-backed');
  if (rule.reviewer && input.articleCount > 0 && input.articlesWithReviewer === 0) moderate.push('reviewer-missing');
  if (severe.length) return { multiplier: YMYL_SEVERE_MULTIPLIER, tier: 'severe', reasons: severe, claimGate };
  if (moderate.length) return { multiplier: YMYL_MODERATE_MULTIPLIER, tier: 'moderate', reasons: moderate, claimGate };
  return { multiplier: 1, tier: 'none', reasons: [], claimGate };
};
