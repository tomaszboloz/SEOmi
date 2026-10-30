import { contentHash } from '@/services/analysisContracts';
import type { TranscriptArtifact } from './modelProviders';

/**
 * Transcripts from captions the page really publishes (#96 GEM-96-06, T03). WebVTT and SRT are parsed
 * deterministically, no speech model and no private recording. Broken cues (end before start, unreadable
 * timecode, overlap) are dropped and counted, so the result is `partial` instead of a silently wrong timeline.
 */
export const CAPTIONS_PROVIDER = 'captions-file';
export const MAX_CAPTION_BYTES = 2_000_000;
export const MAX_CAPTION_CUES = 5000;

export type CaptionIssue = 'bad-timecode' | 'end-before-start' | 'overlap' | 'empty-text' | 'truncated';

export interface CaptionParse {
  status: 'complete' | 'partial' | 'unavailable';
  format: 'vtt' | 'srt' | null;
  transcript: TranscriptArtifact | null;
  issues: Partial<Record<CaptionIssue, number>>;
}

const TIME = /^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})$/u;

export const parseTimecode = (value: string): number | null => {
  const match = TIME.exec(value.trim());
  if (!match) return null;
  const [, hours = '0', minutes, seconds, millis] = match;
  if (Number(minutes) > 59 || Number(seconds) > 59) return null;
  return ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 + Number(millis);
};

const stripMarkup = (text: string): string => text.replace(/<[^>]*>/gu, '').replace(/&amp;/gu, '&').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/\s+/gu, ' ').trim();

export interface CaptionSource { url: string; text: string; language: string | null; analyzedAt: string }

export const parseCaptions = (source: CaptionSource): CaptionParse => {
  const issues: Partial<Record<CaptionIssue, number>> = {};
  const note = (issue: CaptionIssue) => { issues[issue] = (issues[issue] ?? 0) + 1; };
  const raw = source.text.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n');
  const format = /^WEBVTT\b/u.test(raw) ? 'vtt' : /(^|\n)\d+\n[\d:,]+ --> /u.test(raw) ? 'srt' : null;
  if (!format || raw.length > MAX_CAPTION_BYTES) return { status: 'unavailable', format, transcript: null, issues };
  const segments: TranscriptArtifact['segments'] = [];
  for (const block of raw.split(/\n{2,}/u)) {
    const lines = block.split('\n');
    const timing = lines.findIndex((line) => line.includes('-->'));
    if (timing < 0) continue;
    if (segments.length >= MAX_CAPTION_CUES) { note('truncated'); break; }
    const [startText, rest = ''] = lines[timing].split('-->');
    const startMs = parseTimecode(startText);
    const endMs = parseTimecode(rest.trim().split(/\s+/u)[0] ?? '');
    const text = stripMarkup(lines.slice(timing + 1).join(' '));
    if (startMs === null || endMs === null) { note('bad-timecode'); continue; }
    if (endMs <= startMs) { note('end-before-start'); continue; }
    if (!text) { note('empty-text'); continue; }
    const previous = segments[segments.length - 1];
    if (previous && startMs < previous.endMs) note('overlap');
    segments.push({ startMs, endMs, text });
  }
  if (!segments.length) return { status: 'unavailable', format, transcript: null, issues };
  const transcript: TranscriptArtifact = {
    segments,
    provenance: {
      provider: CAPTIONS_PROVIDER, model: format, modelVersion: '1', language: source.language, confidence: null,
      sourceUrl: source.url, contentHash: contentHash(raw), analyzedAt: source.analyzedAt,
    },
  };
  return { status: Object.keys(issues).length ? 'partial' : 'complete', format, transcript, issues };
};
