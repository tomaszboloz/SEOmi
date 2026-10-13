use super::color::Rgb;
use super::doc::{Doc, PAGE_H};
use super::text::Style;
use crate::commands::pdf_report::renderer::encoded_text;

/// Bold is faked with a thin stroke, which widens glyphs slightly.
const BOLD_WIDENING: f32 = 1.04;

impl Doc {
    /// Filled rectangle; `y` is the distance of its top edge from the page top.
    pub fn rect(&mut self, x: f32, y: f32, w: f32, h: f32, color: Rgb) {
        let bottom = PAGE_H - y - h;
        self.cur.push_str(&color.fill_op());
        self.cur
            .push_str(&format!("{x:.2} {bottom:.2} {w:.2} {h:.2} re f\n"));
    }

    pub fn frame(&mut self, x: f32, y: f32, w: f32, h: f32, color: Rgb) {
        let bottom = PAGE_H - y - h;
        self.cur.push_str(&color.stroke_op());
        self.cur
            .push_str(&format!("0.6 w\n{x:.2} {bottom:.2} {w:.2} {h:.2} re S\n"));
    }

    pub fn hline(&mut self, x1: f32, x2: f32, y: f32, color: Rgb, width: f32) {
        let py = PAGE_H - y;
        self.cur.push_str(&color.stroke_op());
        self.cur.push_str(&format!(
            "{width:.2} w\n{x1:.2} {py:.2} m {x2:.2} {py:.2} l S\n"
        ));
    }

    pub fn text_width(&self, text: &str, style: Style) -> f32 {
        let widening = if style.bold { BOLD_WIDENING } else { 1.0 };
        self.fonts.measure(text, style.size) * widening
    }

    /// Draws one line of text with its baseline `baseline` from the page top.
    pub fn text(&mut self, x: f32, baseline: f32, style: Style, text: &str) {
        let py = PAGE_H - baseline;
        self.cur.push_str(&style.color.fill_op());
        if style.bold {
            self.cur.push_str(&style.color.stroke_op());
            self.cur.push_str(&format!("{:.2} w\n", style.size * 0.03));
        }
        let mode = if style.bold { "2 Tr\n" } else { "" };
        let reset = if style.bold { "0 Tr\n" } else { "" };
        let runs = encoded_text(&mut self.fonts, style.size, text);
        self.cur
            .push_str(&format!("BT\n{mode}{x:.2} {py:.2} Td\n{runs}{reset}ET\n"));
    }

    pub fn text_right(&mut self, right: f32, baseline: f32, style: Style, text: &str) {
        let x = right - self.text_width(text, style);
        self.text(x, baseline, style, text);
    }

    pub fn text_center(&mut self, center: f32, baseline: f32, style: Style, text: &str) {
        let x = center - self.text_width(text, style) / 2.0;
        self.text(x, baseline, style, text);
    }

    /// Shortens a single line with an ellipsis so it fits within `width`.
    pub fn fit_line(&self, text: &str, width: f32, style: Style) -> String {
        if self.text_width(text, style) <= width {
            return text.to_owned();
        }
        let mut kept = String::new();
        for character in text.chars() {
            let candidate = format!("{kept}{character}\u{2026}");
            if self.text_width(&candidate, style) > width {
                break;
            }
            kept.push(character);
        }
        format!("{kept}\u{2026}")
    }
}
