use super::color::{Rgb, MUTED, TEXT};
use super::doc::Doc;

/// Placeholder shown wherever a value is missing.
pub const EMPTY: &str = "\u{2014}";

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Style {
    pub size: f32,
    pub color: Rgb,
    pub bold: bool,
}

impl Style {
    pub const fn new(size: f32, color: Rgb, bold: bool) -> Self {
        Self { size, color, bold }
    }

    /// Three-level type scale: title, body and caption.
    pub const TITLE: Style = Style::new(20.0, TEXT, true);
    pub const HEADING: Style = Style::new(12.0, TEXT, true);
    pub const BODY: Style = Style::new(9.0, TEXT, false);
    pub const CAPTION: Style = Style::new(7.5, MUTED, false);

    pub fn leading(self) -> f32 {
        self.size * 1.4
    }

    pub fn colored(self, color: Rgb) -> Self {
        Self { color, ..self }
    }

    pub fn bold(self) -> Self {
        Self { bold: true, ..self }
    }
}

/// Replaces blank text with the missing-value placeholder.
pub fn dash(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        EMPTY.to_owned()
    } else {
        trimmed.to_owned()
    }
}

impl Doc {
    /// Wraps text to `width` points; never returns an empty list.
    pub fn wrap(&self, text: &str, width: f32, style: Style) -> Vec<String> {
        let scale = if style.bold { 0.96 } else { 1.0 };
        self.fonts
            .wrapped_lines(&dash(text), width * scale, style.size)
    }

    /// Draws a wrapped paragraph at the cursor, paginating line by line.
    pub fn paragraph(&mut self, x: f32, width: f32, style: Style, text: &str) {
        for line in self.wrap(text, width, style) {
            self.ensure(style.leading());
            self.text(x, self.y + style.size, style, &line);
            self.y += style.leading();
        }
    }

    pub fn skip(&mut self, height: f32) {
        self.y += height;
    }
}
