use super::{FontKind, FontSet, ARABIC, CJK, LATIN};
use ttf_parser::Face;

impl FontSet {
    pub fn bytes(&self, kind: FontKind) -> &'static [u8] {
        match kind {
            FontKind::Latin => LATIN,
            FontKind::Cjk => CJK,
            FontKind::Arabic => ARABIC,
        }
    }

    pub fn used(&self, kind: FontKind) -> bool {
        self.mappings.get(&kind).is_some_and(|map| !map.is_empty())
    }

    fn scale(value: i32, units: u16) -> i32 {
        value.saturating_mul(1000) / i32::from(units.max(1))
    }

    pub fn face_metrics(&self, kind: FontKind) -> Option<(i32, i32, ttf_parser::Rect)> {
        self.face(kind).map(|face| {
            let units = face.units_per_em();
            let box_ = face.global_bounding_box();
            (
                Self::scale(i32::from(face.ascender()), units),
                Self::scale(i32::from(face.descender()), units),
                ttf_parser::Rect {
                    x_min: Self::scale(i32::from(box_.x_min), units) as i16,
                    y_min: Self::scale(i32::from(box_.y_min), units) as i16,
                    x_max: Self::scale(i32::from(box_.x_max), units) as i16,
                    y_max: Self::scale(i32::from(box_.y_max), units) as i16,
                },
            )
        })
    }

    pub fn mappings(&self, kind: FontKind) -> Vec<(u16, String)> {
        self.mappings
            .get(&kind)
            .map(|map| map.iter().map(|(id, ch)| (*id, ch.clone())).collect())
            .unwrap_or_default()
    }

    pub fn widths(&self, kind: FontKind) -> Vec<(u16, u16)> {
        let units = self.face(kind).map(Face::units_per_em).unwrap_or(1000);
        self.widths
            .get(&kind)
            .map(|set| {
                set.iter()
                    .map(|(id, width)| {
                        (
                            *id,
                            (u32::from(*width) * 1000 / u32::from(units.max(1)))
                                .min(u32::from(u16::MAX)) as u16,
                        )
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
}
