use super::assemble::assemble;
use super::color::{BRAND, MUTED, RULE, WHITE};
use super::text::Style;
use crate::commands::pdf_report::font::FontSet;

pub const PAGE_W: f32 = 595.28;
pub const PAGE_H: f32 = 841.89;
pub const MARGIN: f32 = 40.0;
pub const CONTENT_W: f32 = PAGE_W - 2.0 * MARGIN;
const HEADER_H: f32 = 46.0;
const FOOTER_H: f32 = 36.0;
pub const TOP: f32 = HEADER_H + 18.0;

/// Text shown in the header band and footer of every page.
pub struct Chrome {
    pub title: String,
    pub subtitle: String,
    pub date: String,
    pub note: String,
    pub brand: String,
    pub page_label: String,
}

pub struct Doc {
    pub fonts: FontSet,
    /// Distance of the layout cursor from the top edge of the page.
    pub y: f32,
    pub(super) cur: String,
    pages: Vec<String>,
    chrome: Chrome,
}

impl Doc {
    pub fn new(chrome: Chrome) -> Self {
        let mut doc = Self {
            fonts: FontSet::new(),
            y: TOP,
            cur: String::new(),
            pages: Vec::new(),
            chrome,
        };
        doc.begin_page();
        doc
    }

    fn begin_page(&mut self) {
        self.y = TOP;
        self.rect(0.0, 0.0, PAGE_W, HEADER_H, BRAND);
        let title = Style::new(11.0, WHITE, true);
        self.text(MARGIN, 20.0, title, &self.chrome.title.clone());
        let soft = Style::new(8.0, WHITE.tint(0.0), false);
        let date = self.chrome.date.clone();
        self.text_right(PAGE_W - MARGIN, 20.0, soft, &date);
        let room = CONTENT_W - 10.0;
        let url = self.fit_line(&self.chrome.subtitle.clone(), room, soft);
        self.text(MARGIN, 35.0, soft, &url);
    }

    pub fn new_page(&mut self) {
        let page = std::mem::take(&mut self.cur);
        self.pages.push(page);
        self.begin_page();
    }

    /// Lowest allowed position for content on the current page.
    pub fn limit(&self) -> f32 {
        PAGE_H - FOOTER_H - 12.0
    }

    pub fn remaining(&self) -> f32 {
        self.limit() - self.y
    }

    /// Starts a new page unless `height` still fits on the current one.
    pub fn ensure(&mut self, height: f32) {
        if height > self.remaining() && self.y > TOP + 0.5 {
            self.new_page();
        }
    }

    pub fn page_count(&self) -> usize {
        self.pages.len() + 1
    }

    fn footer(&mut self, page: usize, total: usize) {
        let base = PAGE_H - FOOTER_H;
        self.hline(MARGIN, PAGE_W - MARGIN, base, RULE, 0.6);
        let small = Style::new(7.5, MUTED, false);
        let label = self
            .chrome
            .page_label
            .replace("{page}", &page.to_string())
            .replace("{total}", &total.to_string());
        self.text_right(PAGE_W - MARGIN, base + 13.0, small, &label);
        let note = self.chrome.note.clone();
        let line = self.fit_line(&note, CONTENT_W - 90.0, small);
        self.text(MARGIN, base + 13.0, small, &line);
        let brand = self.chrome.brand.clone();
        self.text(MARGIN, base + 24.0, small, &brand);
    }

    pub fn finish(mut self) -> Vec<u8> {
        let last = std::mem::take(&mut self.cur);
        self.pages.push(last);
        let total = self.pages.len();
        let mut streams = Vec::with_capacity(total);
        for (index, page) in std::mem::take(&mut self.pages).into_iter().enumerate() {
            self.cur = page;
            self.footer(index + 1, total);
            streams.push(std::mem::take(&mut self.cur));
        }
        assemble(&self.fonts, &streams, (PAGE_W, PAGE_H))
    }
}
