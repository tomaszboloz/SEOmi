use super::*;
#[path = "tests/common_fixture.rs"]
mod common_fixture;
use common_fixture::{crawl_config_for_test, post_processing_page};

#[path = "tests/amp.rs"]
mod amp;
#[path = "tests/canonical_1.rs"]
mod canonical_1;
#[path = "tests/canonical_2.rs"]
mod canonical_2;
#[path = "tests/content_1.rs"]
mod content_1;
#[path = "tests/content_2.rs"]
mod content_2;
#[path = "tests/content_3.rs"]
mod content_3;
#[path = "tests/control_svg.rs"]
mod control_svg;
#[path = "tests/duplicates.rs"]
mod duplicates;
#[path = "tests/duplicates_simhash.rs"]
mod duplicates_simhash;
#[path = "tests/filter_validation_edges.rs"]
mod filter_validation_edges;
#[path = "tests/hreflang_1.rs"]
mod hreflang_1;
#[path = "tests/hreflang_2.rs"]
mod hreflang_2;
#[path = "tests/hreflang_edges.rs"]
mod hreflang_edges;
#[path = "tests/hreflang_validation_contracts.rs"]
mod hreflang_validation_contracts;
#[path = "tests/html_1.rs"]
mod html_1;
#[path = "tests/html_2.rs"]
mod html_2;
#[path = "tests/html_attribute_locator_contracts.rs"]
mod html_attribute_locator_contracts;
#[path = "tests/html_attribute_validation_contracts.rs"]
mod html_attribute_validation_contracts;
#[path = "tests/html_evidence_edges.rs"]
mod html_evidence_edges;
#[path = "tests/inline_images_contracts.rs"]
mod inline_images_contracts;
#[path = "tests/ipc.rs"]
mod ipc;
#[path = "tests/js_redirects_contracts.rs"]
mod js_redirects_contracts;
#[path = "tests/js_redirects_edges.rs"]
mod js_redirects_edges;
#[path = "tests/navigation_1.rs"]
mod navigation_1;
#[path = "tests/navigation_2.rs"]
mod navigation_2;
#[path = "tests/post_processing_coverage.rs"]
mod post_processing_coverage;
#[path = "tests/post_processing_edges.rs"]
mod post_processing_edges;
#[path = "tests/prefetch_guards.rs"]
mod prefetch_guards;
#[path = "tests/readability_coverage.rs"]
mod readability_coverage;
#[path = "tests/relations.rs"]
mod relations;
#[path = "tests/resource_apply_contracts.rs"]
mod resource_apply_contracts;
#[path = "tests/resource_contracts.rs"]
mod resource_contracts;
#[path = "tests/resource_discovery_coverage.rs"]
mod resource_discovery_coverage;
#[path = "tests/resources_1.rs"]
mod resources_1;
#[path = "tests/resources_2.rs"]
mod resources_2;
#[path = "tests/robots_1.rs"]
mod robots_1;
#[path = "tests/robots_2.rs"]
mod robots_2;
#[path = "tests/robots_regressions.rs"]
mod robots_regressions;
#[path = "tests/runtime_1.rs"]
mod runtime_1;
#[path = "tests/runtime_2.rs"]
mod runtime_2;
#[path = "tests/runtime_3.rs"]
mod runtime_3;
#[path = "tests/schema.rs"]
mod schema;
#[path = "tests/schema_edges.rs"]
mod schema_edges;
#[path = "tests/schema_graph.rs"]
mod schema_graph;
#[path = "tests/schema_graph_edges.rs"]
mod schema_graph_edges;
#[path = "tests/schema_graph_helper_tests.rs"]
mod schema_graph_helper_tests;
#[path = "tests/schema_references_contracts.rs"]
mod schema_references_contracts;
#[path = "tests/scope.rs"]
mod scope;
#[path = "tests/scope_contracts.rs"]
mod scope_contracts;
#[path = "tests/scope_edges.rs"]
mod scope_edges;
#[path = "tests/semantic_terms_1.rs"]
mod semantic_terms_1;
#[path = "tests/semantic_terms_2.rs"]
mod semantic_terms_2;
#[path = "tests/semantics_coverage.rs"]
mod semantics_coverage;
#[path = "tests/social_1.rs"]
mod social_1;
#[path = "tests/social_2.rs"]
mod social_2;
#[path = "tests/social_bounds.rs"]
mod social_bounds;
#[path = "tests/svg_inline_contracts.rs"]
mod svg_inline_contracts;
#[path = "tests/url_normalization_contracts.rs"]
mod url_normalization_contracts;
#[path = "tests/url_normalization_edges.rs"]
mod url_normalization_edges;
#[path = "tests/wire_contracts.rs"]
mod wire_contracts;
#[path = "tests/wire_result_contracts.rs"]
mod wire_result_contracts;
