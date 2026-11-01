pub mod commands;
#[cfg(test)]
mod compose_suite;
pub mod models;
pub mod services;
mod startup;
#[cfg(test)]
mod startup_tests;
pub mod utils;
use tauri::Builder;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    utils::logging::init();
    desktop_builder()
        .run(tauri::generate_context!())
        .expect("Error while running SEOmi desktop application");
}

/// Shared production composition root, also exercised by the real desktop E2E binary.
pub fn desktop_builder() -> Builder<tauri::Wry> {
    compose(
        Builder::default()
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_notification::init()),
    )
}
/// Runtime-generic state, handlers and startup hook, so MockRuntime tests drive the shipped IPC surface.
pub(crate) fn compose<R: tauri::Runtime>(builder: Builder<R>) -> Builder<R> {
    builder
        .manage(commands::site_crawler::CrawlControl::new())
        .manage(commands::seo_audit::AuditControl::new())
        .manage(commands::seo_audit::AuditRateLimiter::new())
        .manage(commands::seo_audit::AuditTransport::production())
        .manage(commands::render_worker::RenderWorkerState::default())
        .invoke_handler({
            let handler: fn(tauri::ipc::Invoke<R>) -> bool = tauri::generate_handler![
                commands::ai_cli::detect_ai_clis,
                commands::ai_cli::test_ai_cli_connection,
                commands::ai_cli::run_ai_cli,
                commands::ai_provider::ai_generate_text,
                commands::ai_provider::ai_generate_suggestions,
                commands::ai_provider::ai_list_models,
                commands::ai_provider::ai_test_connection,
                commands::audit_queue::load_project_audit_queue,
                commands::audit_queue::save_project_audit_queue,
                commands::audit_queue::delete_project_audit_queue,
                commands::audit_queue::list_project_audit_queue_executions,
                commands::audit_queue::acknowledge_project_audit_queue_execution,
                commands::audit_queue::list_project_audit_queue_results,
                commands::audit_queue::acknowledge_project_audit_queue_result,
                commands::crawl_storage::load_project_crawl_runs,
                commands::crawl_storage::save_project_crawl_runs,
                commands::crawl_storage::load_project_crawl_checkpoint,
                commands::crawl_storage::save_project_crawl_checkpoint,
                commands::crawl_storage::delete_project_crawl_checkpoint,
                commands::run_store::commands::store_save_crawl_run,
                commands::run_store::commands::store_replace_crawl_runs,
                commands::run_store::commands::store_list_crawl_runs,
                commands::run_store::commands::store_load_crawl_run,
                commands::run_store::commands::store_load_crawl_pages,
                commands::run_store::commands::store_delete_crawl_run,
                commands::run_store::commands::store_import_legacy_runs,
                commands::run_store::commands::store_put_record,
                commands::run_store::commands::store_get_record,
                commands::run_store::erase_commands::store_forget_subject,
                commands::run_store::erase_commands::store_erase_project,
                commands::run_store::erase_commands::store_erasure_log,
                commands::run_store::event_commands::store_load_crawl_events,
                commands::run_store::event_commands::store_list_open_crawl_event_runs,
                commands::run_store::event_commands::store_close_interrupted_crawl_events,
                commands::seo_audit::inspect_url,
                commands::seo_audit::cancel_inspect_url,
                commands::http_client::check_link,
                commands::http_client::fetch_registry_profile,
                commands::cms_patch::cms_patch_request,
                commands::external_link_checker::check_external_crawl_links,
                commands::free_feeds::fetch_public_feed,
                commands::rdap::rdap_domain_lookup,
                commands::file_export::write_mcp_config_file,
                commands::mcp_discovery::discover_mcp_tools,
                commands::settings::get_config,
                commands::settings::save_config,
                commands::settings::has_secret,
                commands::settings::set_secret,
                commands::settings::save_crawl_auth_profile,
                commands::settings::delete_crawl_auth_profile,
                commands::dataforseo::dataforseo_request,
                commands::pagespeed::run_pagespeed_insights,
                commands::pagespeed::query_crux_record,
                commands::search_console::ga4::commands::connect_google_analytics,
                commands::search_console::ga4::commands::list_google_analytics_properties,
                commands::search_console::ga4::commands::google_analytics_performance,
                commands::search_console::connect_search_console,
                commands::search_console::list_search_console_properties,
                commands::search_console::search_console_performance,
                commands::search_console::inspect_search_console_url,
                commands::search_console::disconnect_search_console,
                commands::pdf_report::generate_audit_pdf,
                commands::pdf_report::generate_crawl_pdf,
                commands::rendered_crawler::render_crawl_page,
                commands::rendered_crawler::capture_rendered_artifact,
                commands::rendered_crawler::open_rendered_element_preview,
                commands::render_worker::start_render_worker,
                commands::render_worker::stop_render_worker,
                commands::render_worker::render_worker_status,
                commands::image_fetch::fetch_image_bytes,
                commands::bot_dns::dns_reverse,
                commands::bot_dns::dns_forward,
                commands::scheduler::register_audit_wakeup,
                commands::scheduler::unregister_audit_wakeup,
                commands::scheduler::register_audit_queue_wakeup,
                commands::scheduler::unregister_audit_queue_wakeup,
                commands::scheduler::scheduled_launch_context,
                commands::scheduled_worker::save_scheduled_task,
                commands::scheduled_worker::delete_scheduled_task,
                commands::scheduled_worker::load_scheduled_execution,
                commands::scheduled_worker::list_scheduled_executions,
                commands::scheduled_worker::acknowledge_scheduled_execution,
                commands::updater::check_for_updates,
                commands::updater::install_update,
                commands::site_crawler::crawl_site,
                commands::site_crawler::validate_crawl_filters,
                commands::site_crawler::cancel_site_crawl,
                commands::site_crawler::pause_site_crawl,
                commands::site_crawler::resume_site_crawl,
            ];
            move |invoke: tauri::ipc::Invoke<R>| {
                let command = invoke.message.command().to_owned();
                utils::logging::dispatch(&command, || handler(invoke))
            }
        })
        .setup(|app| {
            startup::start_with(
                app,
                startup::launch_context(&std::env::args().collect::<Vec<_>>()),
                startup::run_audit_queue_task,
                startup::run_scheduled_worker_task,
                startup::hide_main_window,
                startup::handle_startup_failure,
                startup::exit_app,
            )?;
            Ok(())
        })
}
