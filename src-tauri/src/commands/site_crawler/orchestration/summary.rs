use tauri::{AppHandle, Emitter};

use super::super::{
    control::{CrawlControl, CrawlProgress},
    models::{CrawledResource, SiteCrawlResult},
    resource_apply::{
        apply_checked_frame_resources, apply_checked_image_resources,
        apply_checked_social_resources,
    },
    scoring::{score_pages, CrawlScore},
};
use super::robots::CrawlRobotsOutcome;
use super::setup::CrawlSetup;
use super::sitemaps::CrawlSitemapsOutcome;
use super::state::CrawlLoopState;

#[allow(clippy::too_many_arguments)]
pub fn build_crawl_result(
    app: &AppHandle,
    control: &CrawlControl,
    setup: &CrawlSetup,
    robots: CrawlRobotsOutcome,
    sitemaps: CrawlSitemapsOutcome,
    state: &mut CrawlLoopState,
    resources: Vec<CrawledResource>,
    resource_limit_reached: bool,
) -> SiteCrawlResult {
    for page in &mut state.pages {
        apply_checked_image_resources(&mut page.images, &resources, &setup.config);
    }
    apply_checked_social_resources(&mut state.pages, &resources, &setup.config);
    apply_checked_frame_resources(&mut state.pages, &resources, &setup.config);

    let CrawlScore {
        critical_count,
        warning_count,
        notice_count,
        health_score,
    } = score_pages(&state.pages);

    let cancelled = control.is_cancelled(&setup.run_id);
    let _ = app.emit(
        "crawl-progress",
        CrawlProgress {
            run_id: setup.run_id.clone(),
            current_url: None,
            discovered: state.visited.len(),
            completed: state.pages.len(),
            queued: state.queue.len() + state.prefetched_order.len(),
            cancelled,
            paused: false,
            elapsed_ms: setup.start_time.elapsed().as_millis() as u64,
            pages_per_second: {
                let elapsed_seconds = setup.start_time.elapsed().as_secs_f64();
                if elapsed_seconds > 0.0 {
                    state.pages.len() as f64 / elapsed_seconds
                } else {
                    0.0
                }
            },
        },
    );

    let limit_reasons = {
        let mut reasons = Vec::new();
        if state.pages.len() >= setup.limit
            && (!state.queue.is_empty() || !state.prefetched_order.is_empty())
        {
            reasons.push("max_pages".into());
        }
        if state.depth_limit_reached {
            reasons.push("max_depth".into());
        }
        if state.pages.iter().any(|page| page.body_truncated) {
            reasons.push("max_response_bytes".into());
        }
        if state.timed_out {
            reasons.push("max_run_seconds".into());
        }
        if state.pages.iter().any(|page| {
            page.issues
                .iter()
                .any(|i| i.message.contains("Redirect limit"))
        }) {
            reasons.push("max_redirects".into());
        }
        if resource_limit_reached {
            reasons.push("max_resource_requests".into());
        }
        reasons
    };

    let result = SiteCrawlResult {
        start_url: setup.normalized_start_url.to_string(),
        crawl_mode: setup.config.crawl_mode.clone(),
        pages_crawled: state.pages.len(),
        health_score,
        critical_count,
        warning_count,
        notice_count,
        pages: std::mem::take(&mut state.pages),
        duration_ms: setup.start_time.elapsed().as_millis() as u64,
        cancelled,
        timed_out: state.timed_out,
        robots_txt_status: robots.robots_txt_status,
        robots_user_agent: setup.ua.clone(),
        robots_applicable_rules: robots.robots_applicable_rules,
        robots_agent_matrix: robots.robots_agent_matrix,
        robots_sitemap_directives: robots.robots_sitemap_directives,
        robots_blocked_count: state.robots_blocked_count,
        sitemap_status: sitemaps.sitemap_status,
        sitemap_urls_discovered: sitemaps.sitemap_urls.len(),
        sitemap_urls: sitemaps.sitemap_urls,
        rejected_urls: std::mem::take(&mut state.rejected_urls),
        resources,
        resource_limit_reached,
        discovery_provenance_truncated: state.discovery_provenance_truncated,
        limit_reasons,
    };
    control.finish(&setup.run_id);
    if let Some(session) = state.rendered_session.take() {
        session.close();
    }
    result
}
