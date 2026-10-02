import type { DraftDiff } from './types';

/**
 * A bounded, deterministic line/multiset diff for editorial review. It does
 * not claim semantic equivalence or fact verification; repeated lines are
 * counted correctly and the visible evidence is capped for large drafts.
 */
export const compareDrafts = (before: string, after: string, evidenceLimit = 40): DraftDiff => {
  const safeLimit = Number.isFinite(evidenceLimit) ? Math.max(1, Math.min(200, Math.floor(evidenceLimit))) : 40;
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const counts = (lines: string[]) => {
    const map = new Map<string, number>();
    lines.forEach((line) => map.set(line, (map.get(line) ?? 0) + 1));
    return map;
  };
  const beforeCounts = counts(beforeLines);
  const afterCounts = counts(afterLines);
  const removedLines: string[] = [];
  const addedLines: string[] = [];
  beforeCounts.forEach((count, line) => {
    const difference = Math.max(0, count - (afterCounts.get(line) ?? 0));
    for (let index = 0; index < difference; index += 1) removedLines.push(line);
  });
  afterCounts.forEach((count, line) => {
    const difference = Math.max(0, count - (beforeCounts.get(line) ?? 0));
    for (let index = 0; index < difference; index += 1) addedLines.push(line);
  });
  const characterCount = (lines: string[]) => lines.reduce((total, line) => total + line.length, 0);
  return {
    changed: before !== after,
    addedLineCount: addedLines.length,
    removedLineCount: removedLines.length,
    addedLines: addedLines.slice(0, safeLimit),
    removedLines: removedLines.slice(0, safeLimit),
    addedCharacterCount: characterCount(addedLines),
    removedCharacterCount: characterCount(removedLines),
  };
};
