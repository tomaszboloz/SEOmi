/**
 * How firmly a sentence asserts its claim (#88 GEM-88-04). A hedged hypothesis ("may lower risk")
 * or a negation ("did not reduce mortality") is reported, but it is not a firm empirical thesis that
 * must carry its own citation. Wording only: it never decides whether the claim is true.
 */
export type ClaimStance = 'firm' | 'hedged' | 'negated';

export const HEDGE = /\b(?:may|might|could|suggests?|possibly|likely|appears?|może|mogą|prawdopodobnie|sugeruj[eą]|wydaje się)\b/iu;
export const NEGATION = /(?:^|[^\p{L}])(?:not|no|never|without|nie|bez|brak)(?=$|[^\p{L}])/iu;

/** Negation wins over hedging: "may not" is reported as negated. */
export const claimStance = (text: string): ClaimStance => (
  NEGATION.test(text) ? 'negated' : HEDGE.test(text) ? 'hedged' : 'firm'
);
