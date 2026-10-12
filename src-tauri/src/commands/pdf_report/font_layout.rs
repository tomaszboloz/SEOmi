use super::{EncodedRun, FontKind, FontSet, Glyph};
use rustybuzz::{Direction, UnicodeBuffer};
use ttf_parser::GlyphId;

impl FontSet {
    pub(super) fn is_arabic_character(character: char) -> bool {
        matches!(u32::from(character), 0x600..=0x6ff | 0x750..=0x77f | 0x8a0..=0x8ff | 0xfb50..=0xfdff | 0xfe70..=0xfeff)
    }

    fn append_encoded(
        &mut self,
        runs: &mut Vec<EncodedRun>,
        kind: FontKind,
        id: u16,
        mapped: String,
        width: u16,
        actual: &str,
    ) {
        self.mappings
            .entry(kind)
            .or_default()
            .entry(id)
            .or_insert(mapped);
        self.widths.entry(kind).or_default().insert(id, width);
        if runs.last().map(|run: &EncodedRun| run.kind) != Some(kind) {
            runs.push(EncodedRun {
                kind,
                hex: String::new(),
                actual_text: Some(String::new()),
            });
        }
        let run = runs
            .last_mut()
            .expect("a run was pushed above when none matched");
        run.hex.push_str(&format!("{id:04X}"));
        if let Some(value) = run.actual_text.as_mut() {
            value.push_str(actual);
        }
    }

    fn encode_arabic(&mut self, text: &str, runs: &mut Vec<EncodedRun>) {
        let Some(face) = self.arabic_shaper.as_ref() else {
            for character in text.chars().rev() {
                self.encode_scalar(character, runs);
            }
            return;
        };
        let mut buffer = UnicodeBuffer::new();
        buffer.push_str(text);
        buffer.set_direction(Direction::RightToLeft);
        let shaped = rustybuzz::shape(face, &[], buffer);
        let glyphs = shaped
            .glyph_infos()
            .iter()
            .map(|info| {
                let id = info.glyph_id as u16;
                let mapped = text
                    .get(info.cluster as usize..)
                    .and_then(|slice| slice.chars().next())
                    .unwrap_or('?')
                    .to_string();
                let width = self
                    .face(FontKind::Arabic)
                    .and_then(|font| font.glyph_hor_advance(GlyphId(id)))
                    .unwrap_or(600);
                (id, mapped, width)
            })
            .collect::<Vec<_>>();
        let start = runs.len();
        for (id, mapped, width) in glyphs {
            self.append_encoded(runs, FontKind::Arabic, id, mapped, width, "");
        }
        if let Some(run) = runs.get_mut(start) {
            run.actual_text = Some(text.to_owned());
        }
    }

    fn encode_scalar(&mut self, character: char, runs: &mut Vec<EncodedRun>) {
        let resolved = self.glyph(character);
        let glyph = resolved.unwrap_or_else(|| self.glyph_or_placeholder('?'));
        let actual = if resolved.is_some() {
            character.to_string()
        } else {
            "?".into()
        };
        self.append_encoded(
            runs,
            glyph.kind,
            glyph.id,
            actual.clone(),
            glyph.width,
            &actual,
        );
    }

    pub(super) fn glyph_or_placeholder(&self, character: char) -> Glyph {
        self.glyph(character)
            .or_else(|| self.glyph('?'))
            .unwrap_or(Glyph {
                kind: FontKind::Latin,
                id: 0,
                width: 600,
            })
    }

    pub fn encode(&mut self, text: &str) -> Vec<EncodedRun> {
        let mut runs = Vec::new();
        let mut index = 0;
        while index < text.len() {
            let character = text[index..].chars().next().unwrap_or('?');
            if Self::is_arabic_character(character) {
                let end = text[index..]
                    .char_indices()
                    .find_map(|(offset, next)| {
                        (!Self::is_arabic_character(next)).then_some(index + offset)
                    })
                    .unwrap_or(text.len());
                self.encode_arabic(&text[index..end], &mut runs);
                index = end;
            } else {
                self.encode_scalar(character, &mut runs);
                index += character.len_utf8();
            }
        }
        runs
    }
}

#[cfg(test)]
#[path = "font_layout_private_tests.rs"]
mod private_tests;

#[cfg(test)]
#[path = "font_layout_run_tests.rs"]
mod run_tests;
