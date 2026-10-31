import { describe, expect, it } from 'vitest';
import { mergeMediaFacts, MAX_CAPTION_BYTES, normalizeFactText, parseCaptions, parseTimecode, type ModelProvenance, type TranscriptArtifact } from '@/services/multimodal';

const src = (text: string) => ({ url: 'https://a.test/v.vtt', text, language: 'pl', analyzedAt: '2026-10-30T00:00:00Z' });
const prov = (confidence: number | null): ModelProvenance => ({ provider: 'p', model: 'm', modelVersion: '1', language: 'ar', confidence, sourceUrl: 'https://a.test/i.png', contentHash: 'h', analyzedAt: 't' });

describe('captions as transcripts (#96 GEM-96-06, T03)', () => {
  it('parses timecodes with and without hours and rejects impossible values', () => {
    expect(parseTimecode('00:01.500')).toBe(1500);
    expect(parseTimecode('01:00:00,001')).toBe(3_600_001);
    expect(parseTimecode('00:61.000')).toBeNull();
    expect(parseTimecode('abc')).toBeNull();
  });

  it('parses WebVTT with markup and keeps provenance', () => {
    const result = parseCaptions(src('﻿WEBVTT\n\n1\n00:00.000 --> 00:02.000 align:start\n<v Jan>Dawka to <b>5 mg</b> &amp; więcej\n\n00:02.000 --> 00:03.000\nKoniec'));
    expect(result.status).toBe('complete');
    expect(result.transcript?.segments).toEqual([{ startMs: 0, endMs: 2000, text: 'Dawka to 5 mg & więcej' }, { startMs: 2000, endMs: 3000, text: 'Koniec' }]);
    expect(result.transcript?.provenance).toMatchObject({ provider: 'captions-file', model: 'vtt', language: 'pl', confidence: null, sourceUrl: 'https://a.test/v.vtt' });
  });

  it('parses SRT and reports broken cues as partial', () => {
    const srt = '1\r\n00:00:01,000 --> 00:00:02,000\r\nOK\r\n\r\n2\r\n00:00:05,000 --> 00:00:04,000\r\nBack\r\n\r\n3\r\n00:00:xx,000 --> 00:00:06,000\r\nBad\r\n\r\n4\r\n00:00:01,500 --> 00:00:03,000\r\nOverlap\r\n\r\n5\r\n00:00:07,000 --> 00:00:08,000\r\n<i></i>\r\n\r\nno timing here';
    const result = parseCaptions(src(srt));
    expect(result).toMatchObject({ status: 'partial', format: 'srt', issues: { 'end-before-start': 1, 'bad-timecode': 1, overlap: 1, 'empty-text': 1 } });
    expect(result.transcript?.segments.map((s) => s.text)).toEqual(['OK', 'Overlap']);
  });

  it('is unavailable for unknown formats, oversize files or files without usable cues', () => {
    expect(parseCaptions(src('just text'))).toMatchObject({ status: 'unavailable', format: null, transcript: null });
    expect(parseCaptions(src(`WEBVTT\n\n${'x'.repeat(MAX_CAPTION_BYTES)}`)).status).toBe('unavailable');
    expect(parseCaptions(src('WEBVTT\n\n00:02.000 --> 00:01.000\nx'))).toMatchObject({ status: 'unavailable', issues: { 'end-before-start': 1 } });
  });
});

describe('media facts joined with HTML (#96 GEM-96-05/07, T03/T04)', () => {
  const transcript: TranscriptArtifact = { segments: [{ startMs: 0, endMs: 900, text: 'Glukometr mierzy cukier we krwi' }, { startMs: 5, endMs: 1, text: 'broken timecode segment' }], provenance: prov(null) };

  it('marks facts already in the HTML, keeps new media text and dedupes repeats', () => {
    const html = '<p>GLUKOMETR   mierzy cukier we krwi!</p>';
    const report = mergeMediaFacts(html, [
      { text: 'Dawka 500 mg dwa razy dziennie', bbox: [0, 0, 10, 4], provenance: prov(0.95) },
      { text: 'dawka 500 MG dwa razy dziennie', bbox: [0, 5, 10, 4], provenance: prov(0.95) },
      { text: 'krótki', bbox: [0, 0, 1, 1], provenance: prov(0.99) },
      { text: 'Ukryty tekst na wykresie', bbox: [0, 0, 0, 4], provenance: prov(0.99) },
    ], [transcript]);
    expect(report.facts.map((f) => [f.origin, f.quality, f.locator.kind])).toEqual([['media-only', 'confident', 'bbox'], ['duplicate-of-html', 'partial', 'timecode']]);
    expect(report.skipped).toBe(4);
  });

  it('keeps low-confidence and RTL text partial, normalized consistently', () => {
    expect(normalizeFactText('  مرحبا   بالعالم! ')).toBe('مرحبا بالعالم');
    const report = mergeMediaFacts('', [{ text: 'مرحبا بالعالم في الصورة', bbox: [1, 1, 5, 5], provenance: prov(0.4) }, { text: 'Wartość NaN pewności tutaj', bbox: [1, 1, 5, 5], provenance: prov(Number.NaN) }], []);
    expect(report.facts.map((f) => f.quality)).toEqual(['partial', 'partial']);
    expect(report.facts[0].provenance.language).toBe('ar');
  });
});
