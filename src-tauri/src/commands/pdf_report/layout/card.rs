use super::color::{Rgb, RULE, WHITE, ZEBRA};
use super::doc::{Doc, CONTENT_W, MARGIN, TOP};
use super::text::Style;

const PAD: f32 = 8.0;
const STRIPE: f32 = 4.0;
const HEADER: f32 = 18.0;
const LABEL_W: f32 = 62.0;
const ROW_GAP: f32 = 3.5;
const HEADLINE: Style = Style::new(10.0, super::color::TEXT, true);

/// A labelled block of text; several items are drawn as a bullet list.
pub struct CardRow {
    pub label: String,
    pub items: Vec<String>,
}

pub struct Card {
    pub accent: Rgb,
    pub badge: String,
    pub meta: String,
    pub tag: String,
    pub headline: String,
    pub rows: Vec<CardRow>,
}

struct VLine {
    label: Option<String>,
    text: String,
    style: Style,
    gap: f32,
}

impl VLine {
    fn height(&self) -> f32 {
        self.gap + self.style.leading()
    }
}

impl Doc {
    fn card_lines(&self, card: &Card) -> Vec<VLine> {
        let inner = CONTENT_W - STRIPE - 2.0 * PAD;
        let mut lines: Vec<VLine> = self
            .wrap(&card.headline, inner, HEADLINE)
            .into_iter()
            .map(|text| VLine {
                label: None,
                text,
                style: HEADLINE,
                gap: 0.0,
            })
            .collect();
        for row in &card.rows {
            let bullets = row.items.len() > 1;
            let mut first = true;
            for item in &row.items {
                let shown = if bullets {
                    format!("\u{2022} {item}")
                } else {
                    item.clone()
                };
                for text in self.wrap(&shown, inner - LABEL_W, Style::BODY) {
                    let label = first.then(|| row.label.clone());
                    let gap = if first { ROW_GAP } else { 0.0 };
                    lines.push(VLine {
                        label,
                        text,
                        style: Style::BODY,
                        gap,
                    });
                    first = false;
                }
            }
        }
        lines
    }

    /// Draws a card; it moves to the next page when it fits there whole and
    /// is split between lines only when it is taller than a page.
    pub fn card(&mut self, card: &Card) {
        let lines = self.card_lines(card);
        let fixed = 2.0 * PAD + HEADER;
        let capacity = self.limit() - TOP - fixed;
        let mut start = 0;
        while start < lines.len() {
            let avail = self.remaining() - fixed;
            let rest: f32 = lines[start..].iter().map(VLine::height).sum();
            if rest > avail && (avail < lines[start].height() || rest <= capacity) {
                self.new_page();
                continue;
            }
            let (mut used, mut take) = (0.0, 0);
            while start + take < lines.len() && used + lines[start + take].height() <= avail {
                used += lines[start + take].height();
                take += 1;
            }
            self.card_chunk(card, &lines[start..start + take], fixed + used);
            start += take;
        }
        self.skip(7.0);
    }

    fn card_chunk(&mut self, card: &Card, lines: &[VLine], height: f32) {
        let top = self.y;
        self.rect(MARGIN, top, CONTENT_W, height, ZEBRA);
        self.frame(MARGIN, top, CONTENT_W, height, RULE);
        self.rect(MARGIN, top, STRIPE, height, card.accent);
        let left = MARGIN + STRIPE + PAD;
        let badge = Style::new(7.0, WHITE, true);
        let pill = self.text_width(&card.badge, badge) + 10.0;
        self.rect(left, top + PAD, pill, 11.0, card.accent);
        self.text(left + 5.0, top + PAD + 8.0, badge, &card.badge);
        self.text(
            left + pill + 7.0,
            top + PAD + 8.2,
            Style::CAPTION,
            &card.meta,
        );
        let right = MARGIN + CONTENT_W - PAD;
        self.text_right(right, top + PAD + 8.2, Style::CAPTION, &card.tag);
        let mut y = top + PAD + HEADER;
        for line in lines {
            y += line.gap;
            let x = left + if line.style == HEADLINE { 0.0 } else { LABEL_W };
            if let Some(label) = &line.label {
                self.text(left, y + 7.0, Style::CAPTION.bold(), label);
            }
            self.text(x, y + line.style.size, line.style, &line.text);
            y += line.style.leading();
        }
        self.y = top + height;
    }
}
