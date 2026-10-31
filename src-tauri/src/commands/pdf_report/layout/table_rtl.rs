use super::doc::{Doc, CONTENT_W, MARGIN};
use super::table::PAD_X;
use super::text::Style;

impl Doc {
    /// Left edge of a column that starts `offset` points into the table.
    /// Right-to-left reports lay columns out from the right margin.
    pub(super) fn column_left(&self, offset: f32, width: f32) -> f32 {
        if self.rtl {
            MARGIN + CONTENT_W - offset - width
        } else {
            MARGIN + offset
        }
    }

    /// Draws cell text inside a column, aligned to the reading start side.
    pub(super) fn cell_text(
        &mut self,
        left: f32,
        width: f32,
        baseline: f32,
        style: Style,
        text: &str,
    ) {
        if self.rtl {
            self.text_right(left + width - PAD_X, baseline, style, text);
        } else {
            self.text(left + PAD_X, baseline, style, text);
        }
    }
}
