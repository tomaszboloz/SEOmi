use super::{EncodedRun, FontSet};
use std::ops::Range;
use unicode_bidi::BidiInfo;

/// A shapeable unit: a whole run of Arabic characters, or one other scalar.
pub(super) struct Segment {
    pub(super) range: Range<usize>,
    pub(super) arabic: bool,
}

impl FontSet {
    pub(super) fn logical_segments(text: &str) -> Vec<Segment> {
        let mut segments: Vec<Segment> = Vec::new();
        for (start, character) in text.char_indices() {
            let arabic = Self::is_arabic_character(character);
            let end = start + character.len_utf8();
            match segments.last_mut() {
                Some(last) if arabic && last.arabic => last.range.end = end,
                _ => segments.push(Segment {
                    range: start..end,
                    arabic,
                }),
            }
        }
        segments
    }

    /// Reorders segments into left-to-right drawing order (UAX #9).
    pub(super) fn visual_segments(text: &str, segments: Vec<Segment>) -> Vec<Segment> {
        let info = BidiInfo::new(text, None);
        let mut ordered = Vec::with_capacity(segments.len());
        for paragraph in &info.paragraphs {
            let (levels, runs) = info.visual_runs(paragraph, paragraph.range.clone());
            for run in runs {
                let mut inside: Vec<&Segment> = segments
                    .iter()
                    .filter(|segment| run.contains(&segment.range.start))
                    .collect();
                if levels[run.start].is_rtl() {
                    inside.reverse();
                }
                ordered.extend(inside.into_iter().map(|segment| Segment {
                    range: segment.range.clone(),
                    arabic: segment.arabic,
                }));
            }
        }
        ordered
    }

    pub fn encode(&mut self, text: &str) -> Vec<EncodedRun> {
        let segments = Self::logical_segments(text);
        let mut runs = Vec::new();
        if !segments.iter().any(|segment| segment.arabic) {
            for segment in segments {
                self.encode_segment(text, &segment, &mut runs);
            }
            return runs;
        }
        for segment in Self::visual_segments(text, segments) {
            self.encode_segment(text, &segment, &mut runs);
        }
        // Glyph order is visual; extraction must still yield the logical text.
        for (index, run) in runs.iter_mut().enumerate() {
            run.actual_text = Some(if index == 0 {
                text.to_owned()
            } else {
                String::new()
            });
        }
        runs
    }

    fn encode_segment(&mut self, text: &str, segment: &Segment, runs: &mut Vec<EncodedRun>) {
        let slice = &text[segment.range.clone()];
        if segment.arabic {
            self.encode_arabic(slice, runs);
        } else if let Some(character) = slice.chars().next() {
            self.encode_scalar(character, runs);
        }
    }
}
