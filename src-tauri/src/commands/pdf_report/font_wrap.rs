use super::FontSet;
use ttf_parser::Face;

impl FontSet {
    pub fn measure(&self, text: &str, size: f32) -> f32 {
        text.chars()
            .map(|character| {
                let glyph = self.glyph_or_placeholder(character);
                let units = self
                    .face(glyph.kind)
                    .map(Face::units_per_em)
                    .unwrap_or(1000);
                f32::from(glyph.width) * size / f32::from(units)
            })
            .sum()
    }

    fn fit_prefix(&self, word: &str, max: f32, size: f32) -> usize {
        let mut end = 0;
        let mut latest_break = None;
        for (index, character) in word.char_indices() {
            let next = index + character.len_utf8();
            if self.measure(&word[..next], size) > max && end > 0 {
                break;
            }
            end = next;
            if matches!(character, '/' | '?' | '&' | '-' | '_' | '=') {
                latest_break = Some(next);
            }
        }
        latest_break
            .filter(|index| *index < end)
            .unwrap_or(end.max(word.chars().next().map(char::len_utf8).unwrap_or(1)))
    }

    pub fn wrapped_lines(&self, value: &str, max: f32, size: f32) -> Vec<String> {
        let mut lines = Vec::new();
        let mut current = String::new();
        for raw in value.split_whitespace() {
            let mut word = raw.to_owned();
            while !word.is_empty() && self.measure(&word, size) > max {
                let count = self.fit_prefix(&word, max, size);
                let tail = word.split_off(count);
                if !current.is_empty() {
                    lines.push(std::mem::take(&mut current));
                }
                lines.push(word);
                word = tail;
            }
            if word.is_empty() {
                continue;
            }
            let joined = if current.is_empty() {
                word.clone()
            } else {
                format!("{current} {word}")
            };
            if self.measure(&joined, size) > max && !current.is_empty() {
                lines.push(std::mem::take(&mut current));
            }
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(&word);
        }
        if !current.is_empty() {
            lines.push(current);
        }
        if lines.is_empty() {
            lines.push("-".into());
        }
        lines
    }
}
