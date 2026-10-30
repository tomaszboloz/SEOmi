export const MICRO_INTENTS = ['definitional', 'how-to', 'troubleshooting', 'comparison', 'curated-list', 'tool', 'transactional', 'local'] as const;
export type MicroIntent = (typeof MICRO_INTENTS)[number];

/** Structural DOM features of one page after chrome removal. */
export interface PageFeatures {
  tables: number;
  orderedLists: number;
  unorderedLists: number;
  formInputs: number;
  calculators: number;
  /** Calculators with a numeric/choice input and an output or action, never a login form; absent in older fixtures. */
  functionalCalculators?: number;
  /** Buttons/links with call-to-action wording in main content; absent means unknown. */
  ctas?: number;
  productCards: number;
  localSignals: number;
  words: number;
  headings: number;
  /** Text of h1-h3, used only for intent wording rules. */
  headingText: string;
}

export interface ObservedMicroIntent {
  primary: MicroIntent | null;
  mixed: MicroIntent[];
  confidence: number;
  scores: Record<MicroIntent, number>;
  evidence: string[];
}

export type Funnel = 'TOFU' | 'MOFU' | 'BOFU';
