use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use regex::Regex;
use scraper::{node::Node, ElementRef, Html, Selector};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use tokio::task::JoinSet;

use crate::commands::settings::CrawlAuthProfile;
use crate::models::audit_data::{FaviconData, StructuredDataValidationIssue};
use crate::services::schema_validator;
use crate::utils::url_validator::validate_and_normalize_url;

mod canonical;
mod client_redirects;
mod constants;
mod content_metrics;
mod content_terms;
mod control;
mod crawl_delay;
mod duplicate_annotation;
mod favicon;
mod fetch_data;
mod fetch_types;
mod filter_validation;
mod fingerprints;
mod frames;
mod hreflang;
mod hreflang_validation;
mod html_decoding;
mod html_source_locator;
mod html_validation;
mod html_validation_rules;
mod image_decoding;
mod inline_images;
mod js_redirects;
mod models;
mod orchestration;
mod pagination;
mod post_processing;
mod prefetch;
mod readability;
mod render_decision;
mod render_fetch;
mod render_health;
mod request_error;
mod resource_apply;
mod resource_discovery;
mod resource_fetch;
mod retry;
mod robots;
mod robots_matching;
mod schema;
mod schema_graph;
mod schema_graph_analysis;
mod schema_graph_analysis_helpers;
mod schema_graph_checks;
mod schema_graph_values;
mod schema_inspections;
mod schema_references;
mod scope;
mod scoring;
mod semantic_chrome;
mod semantic_inflection;
mod semantic_terms;
mod semantics;
mod simhash;
mod sitemap;
mod social;
mod srcset;
mod svg_dimensions;
mod svg_inline;
mod target_relations;
mod transport;
mod url_normalization;

use {
    canonical::*, client_redirects::*, constants::*, content_terms::*, crawl_delay::*,
    fetch_data::*, fetch_types::*, fingerprints::*, hreflang::*, hreflang_validation::*,
    html_source_locator::*, html_validation_rules::*, image_decoding::*, inline_images::*,
    models::*, pagination::*, readability::*, retry::*, robots::*, robots_matching::*,
    schema_graph::*, schema_graph_analysis::*, schema_graph_analysis_helpers::*,
    schema_graph_checks::*, schema_graph_values::*, schema_inspections::*, schema_references::*,
    scope::*, semantic_chrome::*, simhash::*, svg_dimensions::*, svg_inline::*,
    target_relations::*, transport::*, url_normalization::*,
};

#[cfg(test)]
use {
    content_metrics::*, duplicate_annotation::*, favicon::*, frames::*, html_decoding::*,
    html_validation::*, js_redirects::*, post_processing::*, prefetch::*, request_error::*,
    resource_apply::*, resource_discovery::*, schema::*, scoring::*, semantic_inflection::*,
    semantic_terms::*, semantics::*, sitemap::*, social::*, srcset::*,
};

mod ipc;

pub use control::{CrawlControl, CrawlProgress};
pub use filter_validation::{
    __cmd__validate_crawl_filters, __tauri_command_name_validate_crawl_filters,
    validate_crawl_filters,
};
pub use ipc::*;
pub use models::*;
pub use orchestration::crawl_site_with_control;

#[cfg(test)]
#[path = "site_crawler/tests.rs"]
mod tests;
