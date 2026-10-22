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

/** YMYL category of the site from schema types first, then the Core Topic and strongest titles. Undefined when none fits. */
export const detectYmyl = (nodes: SchemaNode[], report: SiteFocusReport | undefined, titles: string[]): YmylCategory | undefined => {
  const counts = new Map<YmylCategory, number>();
  const bump = (category: YmylCategory, by: number): void => { counts.set(category, (counts.get(category) ?? 0) + by); };
  for (const node of nodes) for (const type of node.types) for (const [pattern, category] of SCHEMA_HINT) if (pattern.test(type)) bump(category, 3);
  const topic = [report?.coreTopic.label ?? '', ...(report?.coreTopic.terms.map((term) => term.term) ?? [])].join(' ');
  for (const category of Object.keys(LEXICON) as YmylCategory[]) {
    if (LEXICON[category].test(topic)) bump(category, 4);
    bump(category, titles.filter((title) => LEXICON[category].test(title)).length / Math.max(1, titles.length));
  }
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 3 ? best[0] : undefined;
};
