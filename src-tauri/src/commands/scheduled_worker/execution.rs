use super::models::ScheduledTaskManifest;
use crate::commands::{scheduler, seo_audit, site_crawler};
use serde_json::Value;
use std::future::Future;
use tauri::{AppHandle, Runtime};

#[path = "execution_runner.rs"]
mod runner;
use runner::run_scheduled_task_with;

async fn execute_task_with<Audit, Crawl, AuditFuture, CrawlFuture>(
    task: ScheduledTaskManifest,
    audit: Audit,
    crawl: Crawl,
) -> Result<Value, String>
where
    Audit: Fn(String) -> AuditFuture,
    AuditFuture: Future<Output = Result<Value, String>>,
    Crawl: Fn(ScheduledTaskManifest) -> CrawlFuture,
    CrawlFuture: Future<Output = Result<Value, String>>,
{
    match task.task_type.as_str() {
        "page-audit" => audit(task.url).await,
        "site-crawl" => {
            if task
                .crawl_config
                .as_ref()
                .is_some_and(|value| value.crawl_mode == "browser-rendered")
            {
                return Err("Scheduled browser-rendered crawls require an interactive desktop WebView; use HTTP mode for headless execution.".into());
            }
            crawl(task).await
        }
        _ => Err("Unsupported scheduled task type.".into()),
    }
}

async fn execute_task<R: Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
    task: &ScheduledTaskManifest,
) -> Result<Value, String> {
    let audit = |url: String| async move {
        let result = seo_audit::inspect_url_headless(&url, None, 15).await?;
        serde_json::to_value(result)
            .map_err(|error| format!("Unable to serialize page audit: {error}"))
    };
    let crawl_app = app.clone();
    let crawl_project = project_id.to_owned();
    let crawl = move |task: ScheduledTaskManifest| {
        let app = crawl_app.clone();
        let project_id = crawl_project.clone();
        async move {
            let control = site_crawler::CrawlControl::new();
            let run_id = format!("scheduled-{}", task.schedule_id);
            let config = task.crawl_config.clone();
            let result = site_crawler::crawl_site_with_control(
                app,
                &control,
                task.url,
                Some(task.crawl_limit.unwrap_or(25)),
                config.as_ref().and_then(|value| value.user_agent.clone()),
                Some(run_id),
                Some(project_id),
                config,
            )
            .await?;
            serde_json::to_value(result)
                .map_err(|error| format!("Unable to serialize site crawl: {error}"))
        }
    };
    execute_task_with(task.clone(), audit, crawl).await
}

pub async fn run_scheduled_task<R: Runtime>(
    app: AppHandle<R>,
    project_id: String,
    schedule_id: String,
) -> Result<(), String> {
    let worker_app = app.clone();
    let worker_project = project_id.clone();
    run_scheduled_task_with(
        app,
        project_id,
        schedule_id,
        move |task| {
            let app = worker_app.clone();
            let project_id = worker_project.clone();
            async move { execute_task(&app, &project_id, &task).await }
        },
        |project, schedule, next, interval| {
            scheduler::register_audit_wakeup(project, schedule, next, interval).map(|_| ())
        },
        scheduler::unregister_audit_wakeup,
    )
    .await
}

#[cfg(test)]
#[path = "execution_tests/mod.rs"]
mod tests;
