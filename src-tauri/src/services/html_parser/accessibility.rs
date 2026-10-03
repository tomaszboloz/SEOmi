use super::markup::{aria_hidden_value, semantic_style_hides};
use crate::models::audit_data::{
    AccessibilityAudit, AccessibilityElementEvidence, AccessibilityFinding, AccessibilityLandmark,
};
use scraper::{ElementRef, Html, Selector};
use std::collections::HashSet;

mod anti_spam;
mod attributes;
mod control_offsets;
mod controls;
mod element_offsets;
mod evidence;
mod extraction;
mod findings;
mod focus;
mod hidden_controls;
mod identity;
mod identity_evidence;
mod images;
mod interactive;
mod language;
mod metadata;
mod selector_matching;
mod snippets;

pub(super) use anti_spam::*;
pub(super) use attributes::*;
pub(super) use control_offsets::*;
pub(super) use controls::*;
pub(super) use element_offsets::*;
pub(super) use evidence::*;
pub(super) use extraction::*;
pub(super) use findings::*;
pub(super) use focus::*;
pub(super) use hidden_controls::*;
pub(super) use identity::*;
pub(super) use identity_evidence::*;
pub(super) use images::*;
pub(super) use interactive::*;
pub(super) use language::*;
pub(super) use metadata::*;
pub(super) use selector_matching::*;
pub(super) use snippets::*;

#[cfg(test)]
mod tests;
