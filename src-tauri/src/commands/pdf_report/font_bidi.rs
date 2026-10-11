use std::ops::Range;

use unicode_bidi::{BidiInfo, Level};

use super::font_layout::is_arabic_character;

pub(super) struct VisualRun<'a> {
    pub(super) text: &'a str,
    pub(super) rtl: bool,
    pub(super) arabic: bool,
    pub(super) reverse: bool,
}

struct Atom {
    chars: Range<usize>,
    rtl: bool,
    arabic: bool,
}

fn atom_ranges(text: &str, levels: &[Level]) -> (Vec<(usize, char)>, Vec<Atom>, Vec<usize>) {
    let chars = text
        .char_indices()
        .map(|(start, ch)| (start, ch))
        .collect::<Vec<_>>();
    let mut atoms = Vec::new();
    let mut atom_for_char = vec![0; chars.len()];
    for (index, &(_, character)) in chars.iter().enumerate() {
        let rtl = levels[index].is_rtl();
        let arabic = is_arabic_character(character);
        let same = atoms.last().is_some_and(|atom: &Atom| {
            atom.rtl == rtl && atom.arabic == arabic && atom.chars.end == index
        });
        if same {
            let atom = atoms.last_mut().expect("same atom exists");
            atom.chars.end = index + 1;
            atom_for_char[index] = atoms.len() - 1;
        } else {
            atom_for_char[index] = atoms.len();
            atoms.push(Atom {
                chars: index..index + 1,
                rtl,
                arabic,
            });
        }
    }
    (chars, atoms, atom_for_char)
}

fn atom_text<'a>(text: &'a str, chars: &[(usize, char)], range: &Range<usize>) -> &'a str {
    let start = chars[range.start].0;
    let end = chars
        .get(range.end)
        .map(|(index, _)| *index)
        .unwrap_or(text.len());
    &text[start..end]
}

pub(super) fn visual_runs(text: &str) -> Vec<VisualRun<'_>> {
    let info = BidiInfo::new(text, None);
    let mut result = Vec::new();
    for paragraph in &info.paragraphs {
        let paragraph_text = &text[paragraph.range.clone()];
        let paragraph_start = text[..paragraph.range.start].chars().count();
        let count = paragraph_text.chars().count();
        if count == 0 {
            continue;
        }
        let levels = info.reordered_levels_per_char(paragraph, paragraph.range.clone());
        let levels = &levels[paragraph_start..paragraph_start + count];
        let (chars, atoms, atom_for_char) = atom_ranges(paragraph_text, levels);
        let order = BidiInfo::reorder_visual(levels);
        let mut seen = vec![false; atoms.len()];
        for character_index in order {
            let atom_index = atom_for_char[character_index];
            if seen[atom_index] {
                continue;
            }
            seen[atom_index] = true;
            let atom = &atoms[atom_index];
            result.push(VisualRun {
                text: atom_text(paragraph_text, &chars, &atom.chars),
                rtl: atom.rtl,
                arabic: atom.arabic,
                reverse: atom.rtl && !atom.arabic,
            });
        }
    }
    result
}
