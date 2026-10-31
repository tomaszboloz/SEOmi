import type { AioSnapshot } from '@/services/aioReadiness/history';
import type { AioCalibrationCase } from './aioCalibration';

/**
 * Labelling round-trip for AIO drop-alert calibration (#108). Consecutive crawl snapshots of a
 * project become before/after pairs; a person labels each pair "alert" or "no-alert" in the CSV and
 * pastes it back, and only then does sweepAioThresholds see real labels. Nothing here labels a pair.
 */
export interface AioLabellingPair { id: string; before: number; after: number; drop: number; at: string }
export interface AioLabellingParse { cases: AioCalibrationCase[]; unlabelled: number; errors: Array<{ line: number; reason: 'columns' | 'score' | 'label' | 'duplicate' }> }

export const AIO_LABELLING_HEADER = 'id,before,after,drop,at,label';
const LABELS = new Set(['alert', 'no-alert']);

const profileKey = (item: AioSnapshot): string => (item.profile ? `${item.profile.id}|${item.profile.configHash}` : 'unversioned');
const round = (value: number): number => Math.round(value * 10) / 10;

/** Pairs of consecutive snapshots scored with the same profile; pairs across a profile change are not comparable. */
export const aioLabellingPairs = (history: readonly AioSnapshot[]): AioLabellingPair[] =>
  [...history].sort((left, right) => left.at.localeCompare(right.at)).flatMap((after, index, sorted) => {
    const before = sorted[index - 1];
    if (!before || profileKey(before) !== profileKey(after) || !Number.isFinite(before.score) || !Number.isFinite(after.score)) return [];
    return [{ id: `${before.runId}>${after.runId}`, before: before.score, after: after.score, drop: round(before.score - after.score), at: after.at }];
  });

/** Spreadsheet-safe cell: quoted, doubled quotes, and a leading formula character neutralised. */
const cell = (value: string | number): string => {
  const text = String(value);
  return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
};

export const aioLabellingCsv = (pairs: readonly AioLabellingPair[]): string =>
  [AIO_LABELLING_HEADER, ...pairs.map((pair) => [pair.id, pair.before, pair.after, pair.drop, pair.at, ''].map(cell).join(','))].join('\n');

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted && char === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(current); current = ''; }
    else current += char;
  }
  return [...cells, current].map((value) => value.trim().replace(/^'(?=[=+\-@])/, ''));
};

/** Parses a labelled sheet; blank labels count as unlabelled, anything else invalid is reported per line. */
export const parseAioLabellingCsv = (text: string): AioLabellingParse => {
  const result: AioLabellingParse = { cases: [], unlabelled: 0, errors: [] };
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    if (!raw.trim() || (index === 0 && raw.replace(/"/g, '').trim().toLowerCase().startsWith('id,'))) return;
    const cells = splitCsvLine(raw);
    if (cells.length < 6 || !cells[0]) return void result.errors.push({ line, reason: 'columns' });
    const [id, beforeText, afterText, , , labelText] = cells;
    const before = Number(beforeText);
    const after = Number(afterText);
    if (!beforeText || !afterText || !Number.isFinite(before) || !Number.isFinite(after)) return void result.errors.push({ line, reason: 'score' });
    const label = labelText.toLowerCase();
    if (!label) { result.unlabelled += 1; return; }
    if (!LABELS.has(label)) return void result.errors.push({ line, reason: 'label' });
    if (seen.has(id)) return void result.errors.push({ line, reason: 'duplicate' });
    seen.add(id);
    result.cases.push({ id, before, after, expected: label as AioCalibrationCase['expected'] });
  });
  return result;
};
