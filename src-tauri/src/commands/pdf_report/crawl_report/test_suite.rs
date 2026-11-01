//! Test modules of the crawl report, kept apart so `crawl_report.rs` stays under the 150-line limit.
//! The glob import keeps `super::<item>` paths in the test modules resolving to crawl_report's items.

#[allow(unused_imports)]
use super::*;

#[path = "coverage100_tests.rs"]
mod coverage100_tests;
#[path = "fixture.rs"]
mod fixture;
#[path = "fixture_run.rs"]
mod fixture_run;
#[path = "tests.rs"]
mod tests;
#[path = "tests_agg.rs"]
mod tests_agg;
#[path = "tests_aio.rs"]
mod tests_aio;
#[path = "tests_aio_inspector.rs"]
mod tests_aio_inspector;
#[path = "tests_authority.rs"]
mod tests_authority;
#[path = "tests_data.rs"]
mod tests_data;
#[path = "tests_evidence.rs"]
mod tests_evidence;
#[path = "tests_focus.rs"]
mod tests_focus;
#[path = "tests_focus_brand.rs"]
mod tests_focus_brand;
#[path = "tests_focus_more.rs"]
mod tests_focus_more;
#[path = "tests_focus_protection.rs"]
mod tests_focus_protection;
#[path = "tests_focus_segments.rs"]
mod tests_focus_segments;
#[path = "tests_focus_visual.rs"]
mod tests_focus_visual;
#[path = "tests_link_zones.rs"]
mod tests_link_zones;
#[path = "tests_more.rs"]
mod tests_more;
#[path = "tests_offpage.rs"]
mod tests_offpage;
#[path = "tests_offpage_edges.rs"]
mod tests_offpage_edges;
#[path = "tests_sections.rs"]
mod tests_sections;
#[path = "tests_trust.rs"]
mod tests_trust;
