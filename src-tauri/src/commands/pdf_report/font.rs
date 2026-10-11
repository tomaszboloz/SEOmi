use std::collections::BTreeMap;

use ttf_parser::Face;

const LATIN: &[u8] = include_bytes!("../../../assets/NotoSans-Regular.ttf");
const CJK: &[u8] = include_bytes!("../../../assets/NotoSansCJKsc-Regular.otf");
const ARABIC: &[u8] = include_bytes!("../../../assets/NotoSansArabic-Regular.ttf");

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum FontKind {
    Latin,
    Cjk,
    Arabic,
}

impl FontKind {
    pub fn resource(self) -> &'static str {
        match self {
            Self::Latin => "F1",
            Self::Cjk => "F2",
            Self::Arabic => "F3",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Glyph {
    pub kind: FontKind,
    pub id: u16,
    pub width: u16,
}

#[derive(Clone, Debug)]
pub struct EncodedRun {
    pub kind: FontKind,
    pub hex: String,
    pub actual_text: Option<String>,
}

pub struct FontSet {
    latin: Option<Face<'static>>,
    cjk: Option<Face<'static>>,
    arabic: Option<Face<'static>>,
    arabic_shaper: Option<rustybuzz::Face<'static>>,
    mappings: BTreeMap<FontKind, BTreeMap<u16, String>>,
    widths: BTreeMap<FontKind, BTreeMap<u16, u16>>,
}

#[path = "font_layout.rs"]
mod font_layout;

#[path = "font_resources.rs"]
mod font_resources;

#[path = "font_wrap.rs"]
mod font_wrap;

impl Default for FontSet {
    fn default() -> Self {
        Self::new()
    }
}

impl FontSet {
    pub fn new() -> Self {
        Self {
            latin: Face::parse(LATIN, 0).ok(),
            cjk: Face::parse(CJK, 0).ok(),
            arabic: Face::parse(ARABIC, 0).ok(),
            arabic_shaper: rustybuzz::Face::from_slice(ARABIC, 0),
            mappings: BTreeMap::new(),
            widths: BTreeMap::new(),
        }
    }

    pub(super) fn face(&self, kind: FontKind) -> Option<&Face<'static>> {
        match kind {
            FontKind::Latin => self.latin.as_ref(),
            FontKind::Cjk => self.cjk.as_ref(),
            FontKind::Arabic => self.arabic.as_ref(),
        }
    }

    fn candidate_kinds(character: char) -> [FontKind; 2] {
        let code = u32::from(character);
        if matches!(code, 0x600..=0x6ff | 0x750..=0x77f | 0x8a0..=0x8ff | 0xfb50..=0xfdff | 0xfe70..=0xfeff)
        {
            [FontKind::Arabic, FontKind::Latin]
        } else if matches!(code, 0x2e80..=0x9fff | 0xac00..=0xd7ff | 0xf900..=0xfaff | 0x20000..=0x3134f)
        {
            [FontKind::Cjk, FontKind::Latin]
        } else {
            [FontKind::Latin, FontKind::Cjk]
        }
    }

    pub fn glyph(&self, character: char) -> Option<Glyph> {
        for kind in Self::candidate_kinds(character) {
            let Some(face) = self.face(kind) else {
                continue;
            };
            let Some(id) = face.glyph_index(character) else {
                continue;
            };
            if id.0 == 0 {
                continue;
            }
            let width = face.glyph_hor_advance(id).unwrap_or(face.units_per_em());
            return Some(Glyph {
                kind,
                id: id.0,
                width,
            });
        }
        None
    }
}
