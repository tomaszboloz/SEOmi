use crate::models::audit_data::TechnologySignal;
use scraper::{Html, Selector};

mod asset_names;
mod assets;
mod generator;
mod markers;
mod signals;
mod versions;
pub(super) use asset_names::*;
pub(super) use assets::*;
pub(super) use generator::*;
pub(super) use markers::*;
pub(super) use signals::*;
pub(super) use versions::*;

pub(super) fn detect_html_technologies(
    document: &Html,
    html: &str,
    generator: Option<&str>,
) -> Vec<TechnologySignal> {
    let mut signals = Vec::new();
    generator_signals(generator, &mut signals);
    let lower_html = html.to_ascii_lowercase();
    marker_signals(document, &lower_html, &mut signals);
    asset_signals(document, &lower_html, &mut signals);
    signals
}
#[cfg(test)]
mod tests;
