/** Bounds on the per-project business goal (#82): one short sentence, not a document. */
export const MIN_GOAL_LENGTH = 3;
export const MAX_GOAL_LENGTH = 200;

export type GoalError = 'too-short' | 'too-long' | 'no-words' | 'looks-like-url';
export type GoalCheck = { ok: true; value: string } | { ok: false; error: GoalError };

/**
 * Validates a typed business goal. It must contain words (letters in any script) and must not be a
 * URL: anchor pages have their own field. Invalid input is rejected, never repaired or guessed.
 */
export const checkBusinessGoal = (input: unknown): GoalCheck => {
  const value = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  if (value.length < MIN_GOAL_LENGTH) return { ok: false, error: 'too-short' };
  if (value.length > MAX_GOAL_LENGTH) return { ok: false, error: 'too-long' };
  if (/^(https?:\/\/|www\.)\S*$/i.test(value)) return { ok: false, error: 'looks-like-url' };
  if (!/\p{L}{2,}/u.test(value)) return { ok: false, error: 'no-words' };
  return { ok: true, value };
};
