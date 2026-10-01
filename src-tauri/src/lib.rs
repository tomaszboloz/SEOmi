pub mod commands;
pub mod models;
pub mod services;
pub mod utils;

use tauri::{Builder, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .manage(commands::site_crawler::CrawlControl::new())
        .manage(commands::seo_audit::AuditControl::new())
        .manage(commands::render_worker::RenderWorkerState::default())
        .invoke_handler(tauri::generate_handler![
            commands::ai_cli::detect_ai_clis,
            commands::ai_cli::test_ai_cli_connection,
            commands::ai_cli::run_ai_cli,
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
            commands::seo_audit::inspect_url,
            commands::seo_audit::cancel_inspect_url,
            commands::http_client::check_link,
            commands::external_link_checker::check_external_crawl_links,
            commands::file_export::write_mcp_config_file,
            commands::mcp_discovery::discover_mcp_tools,
            commands::settings::get_config,
            commands::settings::save_config,
            commands::settings::get_secret,
            commands::settings::set_secret,
            commands::settings::save_crawl_auth_profile,
            commands::settings::delete_crawl_auth_profile,
            commands::dataforseo::dataforseo_request,
            commands::pagespeed::run_pagespeed_insights,
            commands::pagespeed::query_crux_record,
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
        ])
        .setup(|app| {
            if let Some((project_id, run_id)) =
                commands::audit_queue_worker::headless_launch_context()
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = commands::audit_queue_worker::run_audit_queue(
                        handle.clone(),
                        project_id,
                        run_id,
                    )
                    .await
                    {
                        log::error!("Headless audit queue failed: {error}");
                    }
                    handle.exit(0);
                });
                return Ok(());
            }
            if let Some((project_id, schedule_id)) =
                commands::scheduled_worker::headless_launch_context()
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = commands::scheduled_worker::run_scheduled_task(
                        handle.clone(),
                        project_id,
                        schedule_id,
                    )
                    .await
                    {
                        log::error!("Scheduled desktop task failed: {error}");
                    }
                    handle.exit(0);
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running SEOmi desktop application");
}
