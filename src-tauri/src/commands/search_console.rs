mod browser;
mod callback;
mod callback_io;
mod connect;
mod credentials;
mod dates;
mod disconnect;
mod filters;
mod fragments;
mod inspection;
mod mapping;
mod models;
mod performance;
mod performance_source;
mod performance_transport;
mod pkce;
mod properties;
mod requests;
mod rows;
mod session;
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
#[path = "search_console/browser_contract_tests.rs"]
mod browser_contract_tests;
#[cfg(test)]
mod callback_io_tests;
#[cfg(test)]
mod callback_tests;
#[cfg(test)]
mod command_tests;
#[cfg(test)]
#[path = "search_console/connect_entry_tests.rs"]
mod connect_entry_tests;
#[cfg(test)]
#[path = "search_console/disconnect_transport_tests.rs"]
mod disconnect_transport_tests;
#[cfg(test)]
#[path = "search_console/inspection_entry_tests.rs"]
mod inspection_entry_tests;
#[cfg(test)]
mod joint_rows_tests;
mod oauth_response;
#[cfg(test)]
#[path = "search_console/oauth_response_tests.rs"]
mod oauth_response_tests;
#[cfg(test)]
#[path = "search_console/performance_entry_tests.rs"]
mod performance_entry_tests;
#[cfg(test)]
#[path = "search_console/performance_fixture.rs"]
mod performance_fixture;
#[cfg(test)]
#[path = "search_console/properties_entry_tests.rs"]
mod properties_entry_tests;
#[cfg(test)]
mod rows_entry_tests;
#[cfg(test)]
mod rows_test_fixture;
#[cfg(test)]
mod rows_transport_tests;

#[cfg(test)]
#[path = "search_console/property_mapping_tests.rs"]
mod property_mapping_tests;

#[cfg(test)]
#[path = "search_console/session_test_modules.rs"]
mod session_test_modules;

#[cfg(test)]
mod token_transport_tests;
#[cfg(test)]
mod transport_fixture;

#[cfg(test)]
#[path = "search_console/performance_transport_direct_tests.rs"]
mod performance_transport_direct_tests;

#[cfg(test)]
#[path = "search_console/session_disconnect_coverage_tests.rs"]
mod session_disconnect_coverage_tests;

#[cfg(test)]
#[path = "search_console/command_handler_tests.rs"]
mod command_handler_tests;

#[cfg(test)]
#[path = "search_console/command_ipc_tests.rs"]
mod command_ipc_tests;
