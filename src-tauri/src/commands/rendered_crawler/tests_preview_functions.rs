use super::models::{PREVIEW_NEEDLE_MAX_CHARS, PREVIEW_SELECTOR_MAX_CHARS};
use super::preview::{normalize_preview_value, open_rendered_element_preview};
use crate::utils::test_app::StorageApp;
use tauri::{test::mock_builder, test::MockRuntime, AppHandle};

async fn open_preview(
    app: &AppHandle<MockRuntime>,
    url: &str,
    selector: &str,
    needle: Option<&str>,
    title: &str,
    msg: &str,
) -> Result<(), String> {
    open_rendered_element_preview(
        app.clone(),
        url.into(),
        selector.into(),
        needle.map(String::from),
        None,
        title.into(),
        msg.into(),
    )
    .await
}

#[path = "tests_preview_functions_part1.rs"]
mod part1;
#[path = "tests_preview_functions_part2.rs"]
mod part2;
