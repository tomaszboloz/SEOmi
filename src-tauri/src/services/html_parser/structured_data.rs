use crate::models::audit_data::StructuredData;
use crate::services::schema_validator;
use scraper::{Html, Selector};

mod jsonld;
mod microdata;
mod rdfa;
mod types;
pub(super) use jsonld::*;
pub(super) use microdata::*;
pub(super) use rdfa::*;
pub(super) use types::*;

pub(super) fn extract_structured_data(document: &Html) -> Vec<StructuredData> {
    let mut list = extract_jsonld(document);
    list.extend(extract_microdata(document));
    list.extend(extract_rdfa(document));
    list
}
#[cfg(test)]
mod tests;
