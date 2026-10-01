use crate::models::audit_data::StructuredDataValidationIssue;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use url::Url;

const MAX_JSONLD_NODES: usize = 2_048;
const MAX_JSONLD_DEPTH: usize = 64;
const MAX_JSONLD_TYPES_PER_NODE: usize = 64;
const MAX_VALIDATION_ISSUES: usize = 500;
const MAX_CONTEXT_DEPTH: usize = 16;

mod context;
mod issues;
mod jsonld;
mod microdata;
mod profile_values;
mod profiles;
mod property_shapes;
mod rdfa;
mod types;

use context::{context_contains_schema_org, schema_org_iri, JsonLdContext};
use issues::{issue, IssueCollector};
use profile_values::validate_jsonld_profile_values;
use profiles::validate_profile;
use property_shapes::*;
use types::{type_name, type_values};

pub use jsonld::validate_jsonld;
pub use microdata::validate_microdata;
pub use rdfa::validate_rdfa;

pub fn validate(format: &str, content: &Value) -> Vec<StructuredDataValidationIssue> {
    match format {
        "JSON-LD" => validate_jsonld(content),
        "Microdata" => validate_microdata(content),
        "RDFa" => validate_rdfa(content),
        _ => vec![issue(
            "schema-format-unsupported",
            "info",
            format!("No local validation rules are defined for `{format}`."),
            None,
            None,
        )],
    }
}

#[cfg(test)]
mod tests;
