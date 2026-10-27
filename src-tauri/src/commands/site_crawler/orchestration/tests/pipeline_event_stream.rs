use super::super::pipeline::run_crawl_pipeline;
use super::discovery_http_fixture::{delayed_route, html_route, route, DiscoveryServer};
use super::setup_config::default_crawl_config;
use super::*;
use crate::commands::run_store::{commands::open_store, events::load_events};
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

trait SetupTake {
    fn take_setup(&mut self) -> crate::commands::site_crawler::orchestration::setup::CrawlSetup;
}

impl SetupTake for DiscoveryServer {
    fn take_setup(&mut self) -> crate::commands::site_crawler::orchestration::setup::CrawlSetup {
        let replacement = super::setup(default_crawl_config(None));
        std::mem::replace(&mut self.setup, replacement)
    }
}

#[tokio::test]
async fn pipeline_persists_pages_before_crawl_completion() {
    let mut config = default_crawl_config(Some(2));
    config.discover_sitemaps = false;
    config.max_concurrent_requests = Some(1);
    config.max_resource_requests = Some(0);
    let mut server = DiscoveryServer::new(
        config,
        vec![
            route("/robots.txt", 200, "User-agent: *\nAllow: /\n"),
            html_route("/", "<html><body><a href='/slow'>slow</a></body></html>"),
            delayed_route("/slow", 200, "<html><body><h1>Slow</h1></body></html>", 500),
        ],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let mut setup = server.take_setup();
    setup.project_id = Some("project-stream".into());
    setup.run_id = "run-stream".into();
    let handle = app.handle();
    let task =
        tokio::spawn(
            async move { run_crawl_pipeline(&handle, &CrawlControl::new(), &setup).await },
        );

    let mut observed = Vec::new();
    for _ in 0..100 {
        if let Ok(conn) = open_store(&app.handle(), "project-stream") {
            observed = load_events(&conn, "project-stream", "run-stream", 1, 10).unwrap();
            if observed
                .iter()
                .any(|event| event.event_type == "crawl:page")
            {
                break;
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    assert!(observed
        .iter()
        .any(|event| event.event_type == "crawl:started"));
    assert!(observed
        .iter()
        .any(|event| event.event_type == "crawl:page"));
    assert!(
        !task.is_finished(),
        "page event must be visible while crawl is still running"
    );
    let result = task.await.unwrap().unwrap();
    assert_eq!(result.pages_crawled, 2);
    let conn = open_store(&app.handle(), "project-stream").unwrap();
    let complete = load_events(&conn, "project-stream", "run-stream", 1, 10).unwrap();
    assert_eq!(complete.last().unwrap().event_type, "crawl:completed");
}
