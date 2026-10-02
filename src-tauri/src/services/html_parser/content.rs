const MAX_STORED_BODY_TEXT_CHARS: usize = 200_000;

use super::markup::{aria_hidden_value, semantic_style_hides};
use crate::models::audit_data::{ContentStats, KeywordStat};
use scraper::node::Node;
use scraper::{ElementRef, Html, Selector};
use std::collections::HashMap;

mod extraction;
mod keywords;
mod language;
mod metrics;
mod readability;
mod semantic;
mod stop_words;
mod stop_words_baseline;
mod stop_words_european;
mod stop_words_russian;
mod syllables;
mod tokens;
mod visible_text;

pub(super) use extraction::*;
pub(super) use keywords::*;
pub(super) use language::*;
pub(super) use metrics::*;
pub(super) use readability::*;
pub(super) use semantic::*;
pub(super) use stop_words::*;
pub(super) use syllables::*;
pub(super) use tokens::*;
pub(super) use visible_text::*;

#[cfg(test)]
mod tests;
