use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, COOKIE, USER_AGENT};
use scraper::{node::Node, ElementRef, Html, Selector};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::error::Error;
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

const MAX_SEMANTIC_CONTENT_LINKS_PER_PAGE: usize = 1_000;
const MAX_SEMANTIC_TERMS_PER_PAGE: usize = 40;
const MAX_SEMANTIC_EXCERPTS_PER_PAGE: usize = 8;
const MAX_SCHEMA_DECLARATIONS_PER_PAGE: usize = 100;
const MAX_SCHEMA_FINDINGS_PER_PAGE: usize = 200;
const MAX_SCHEMA_REFERENCES_PER_PAGE: usize = 64;
const MAX_SCHEMA_REFERENCE_VALUE_CHARS: usize = 2_048;
const MAX_SRCSET_CANDIDATES_PER_IMAGE: usize = 20;
const MAX_RESOURCE_DISCOVERY_CANDIDATES: usize = 10_000;
const MAX_HTML_VALIDATION_FINDINGS_PER_PAGE: usize = 200;
const MAX_IFRAMES_PER_PAGE: usize = 500;
const MAX_INLINE_IMAGE_URI_CHARS: usize = 8_192;
const MAX_ROBOTS_RULES: usize = 100;
/// Resource crawling is opt-in. When enabled, retain only a bounded prefix of
/// an image response for intrinsic-dimension decoding; the response body is
/// never persisted in the crawl snapshot.
const MAX_INTRINSIC_IMAGE_BYTES: usize = 8 * 1024 * 1024;

mod canonical;
mod content_metrics;
mod control;
mod fetch_data;
mod fetch_types;
mod filter_validation;
mod fingerprints;
mod hreflang;
mod html_validation;
mod image_decoding;
mod inline_images;
mod models;
mod orchestration;
mod post_processing;
mod resource_apply;
mod resource_discovery;
mod resource_fetch;
mod robots;
mod schema;
mod scoring;
mod scope;
mod semantics;
mod simhash;
mod social;
mod srcset;
mod svg_dimensions;
mod svg_inline;
mod transport;
mod url_normalization;

use {
    canonical::*, content_metrics::*, control::*, fetch_data::*, fetch_types::*,
    filter_validation::*, fingerprints::*, hreflang::*, html_validation::*,
    image_decoding::*, inline_images::*, models::*, post_processing::*,
    resource_apply::*, resource_discovery::*, resource_fetch::*, robots::*,
    schema::*, scoring::*, scope::*, semantics::*, simhash::*, social::*,
    srcset::*, svg_dimensions::*, svg_inline::*, transport::*, url_normalization::*,
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
