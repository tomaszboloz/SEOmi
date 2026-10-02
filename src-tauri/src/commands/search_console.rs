mod browser;
mod callback;
mod callback_io;
mod connect;
mod credentials;
mod dates;
mod disconnect;
mod filters;
mod inspection;
mod mapping;
mod models;
mod performance;
mod pkce;
mod properties;
mod requests;
mod rows;
mod tokens;

pub use models::{GscPerformanceFilters, GscSiteProperty};
use serde_json::Value;

#[tauri::command]
pub async fn connect_search_console(
    project_id: String,
    client_id: String,
    client_secret: Option<String>,
) -> Result<Vec<GscSiteProperty>, String> {
    connect::connect_search_console(project_id, client_id, client_secret).await
}

#[tauri::command]
pub async fn list_search_console_properties(
    project_id: String,
    client_id: String,
) -> Result<Vec<GscSiteProperty>, String> {
    properties::list_search_console_properties(project_id, client_id).await
}

#[tauri::command]
pub async fn search_console_performance(
    project_id: String,
    client_id: String,
    site_url: String,
    start_date: Option<String>,
    end_date: Option<String>,
    filters: Option<GscPerformanceFilters>,
) -> Result<Value, String> {
    performance::search_console_performance(
        project_id, client_id, site_url, start_date, end_date, filters,
    )
    .await
}

#[tauri::command]
pub async fn inspect_search_console_url(
    project_id: String,
    client_id: String,
    site_url: String,
    inspection_url: String,
) -> Result<Value, String> {
    inspection::inspect_search_console_url(project_id, client_id, site_url, inspection_url).await
}

#[tauri::command]
pub async fn disconnect_search_console(project_id: String) -> Result<String, String> {
    disconnect::disconnect_search_console(project_id).await
}

#[cfg(test)]
mod analytics_tests;
#[cfg(test)]
mod callback_io_tests;
#[cfg(test)]
mod callback_tests;
#[cfg(test)]
mod command_tests;
#[cfg(test)]
mod joint_rows_tests;
#[cfg(test)]
mod rows_test_fixture;
#[cfg(test)]
mod rows_transport_tests;
#[cfg(test)]
mod token_transport_tests;
#[cfg(test)]
mod transport_regressions;
#[cfg(test)]
mod validation_tests;
