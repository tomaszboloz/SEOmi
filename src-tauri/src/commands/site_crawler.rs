use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, COOKIE, USER_AGENT};
use scraper::{node::Node, ElementRef, Html, Selector};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tokio::task::JoinSet;

use crate::commands::rendered_crawler::{RenderOptions, RenderedCrawlerSession};
use crate::commands::settings::{crawl_auth_profile, CrawlAuthProfile};
use crate::models::audit_data::{FaviconData, StructuredDataValidationIssue};
use crate::services::custom_search::{
    extract_custom_search_results_with_html, validate_custom_searches, CrawledCustomSearchResult,
    CustomSearchDefinition, MAX_CUSTOM_SEARCH_CHARS_PER_RUN,
};
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
mod request_error;
mod resource_apply;
mod resource_discovery;
mod resource_fetch;
mod robots;
mod robots_matching;
mod schema;
mod schema_inspections;
mod schema_references;
mod scope;
mod scoring;
mod semantic_chrome;
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
    canonical::*, client_redirects::*, constants::*, content_metrics::*, content_terms::*,
    control::*, crawl_delay::*, duplicate_annotation::*, favicon::*, fetch_data::*, fetch_types::*,
    filter_validation::*, fingerprints::*, frames::*, hreflang::*, hreflang_validation::*,
    html_decoding::*, html_source_locator::*, html_validation::*, html_validation_rules::*,
    image_decoding::*, inline_images::*, js_redirects::*, models::*, pagination::*,
    post_processing::*, prefetch::*, readability::*, request_error::*, resource_apply::*,
    resource_discovery::*, resource_fetch::*, robots::*, robots_matching::*, schema::*,
    schema_inspections::*, schema_references::*, scope::*, scoring::*, semantic_chrome::*,
    semantics::*, simhash::*, sitemap::*, social::*, srcset::*, svg_dimensions::*, svg_inline::*,
    target_relations::*, transport::*, url_normalization::*,
};

pub use control::{CrawlControl, CrawlProgress};
pub use filter_validation::{
    __cmd__validate_crawl_filters, __tauri_command_name_validate_crawl_filters,
    validate_crawl_filters,
};
pub use models::{
    CrawlConfig, CrawlFilterPreview, CrawlFilterValidationError, CrawlFilterValidationResult,
    CrawledCanonicalTarget, CrawledClientRedirect, CrawledContentTerm, CrawledDiscoverySource,
    CrawledDuplicateHeading, CrawledFocusPhraseEvidence, CrawledFrame, CrawledHreflang,
    CrawledHtmlValidationFinding, CrawledImage, CrawledImageResourceCheck,
    CrawledIndexabilityVerdict, CrawledLink, CrawledPageIssue, CrawledPageSummary,
    CrawledPaginationLink, CrawledRedirectHop, CrawledResource, CrawledRobotsAgent,
    CrawledRobotsDecision, CrawledRobotsRule, CrawledSchemaFinding, CrawledSchemaReference,
    CrawledSocialMetaTag, CrawledSocialResourceCheck, RejectedCrawlUrl, SiteCrawlResult,
};
pub use orchestration::crawl_site_with_control;

#[tauri::command]
pub fn cancel_site_crawl(run_id: String, control: State<'_, CrawlControl>) -> Result<(), String> {
    control
        .cancelled_runs
        .lock()
        .map_err(|_| "Crawler cancellation state is unavailable.".to_string())?
        .insert(run_id);
    Ok(())
}

#[tauri::command]
pub fn pause_site_crawl(run_id: String, control: State<'_, CrawlControl>) -> Result<(), String> {
    if control.is_cancelled(&run_id) {
        return Err("Cannot pause a cancelled crawl.".into());
    }
    control.pause(&run_id);
    Ok(())
}

#[tauri::command]
pub fn resume_site_crawl(run_id: String, control: State<'_, CrawlControl>) -> Result<(), String> {
    control.resume(&run_id);
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn crawl_site(
    app: AppHandle,
    control: State<'_, CrawlControl>,
    start_url: String,
    max_pages: Option<usize>,
    user_agent: Option<String>,
    run_id: Option<String>,
    project_id: Option<String>,
    config: Option<CrawlConfig>,
) -> Result<SiteCrawlResult, String> {
    crawl_site_with_control(
        app, &control, start_url, max_pages, user_agent, run_id, project_id, config,
    )
    .await
}

#[cfg(test)]
#[path = "site_crawler/tests.rs"]
mod tests;
