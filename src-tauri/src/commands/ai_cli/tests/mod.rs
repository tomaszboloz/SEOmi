use super::{
    arguments::build_ai_cli_arguments,
    auth::{authenticated_output, required_capabilities},
    capabilities::check_capabilities,
    diagnostics::cli_response,
    research::{
        collect_research_output, gemini_research_settings, isolate_process, ResearchDirectory,
    },
    resolution::ResolvedCommand,
    streams::read_cli_stream,
};
use std::{env, fs};
use tokio::time::Duration;
use uuid::Uuid;

mod arguments;
pub(super) mod binary_fixture;
mod capabilities;
mod fixtures;
mod processes;
mod settings;
pub(super) use fixtures::{collect_fixture_output, fixture_process};
