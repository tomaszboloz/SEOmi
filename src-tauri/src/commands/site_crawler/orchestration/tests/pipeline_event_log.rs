use super::super::pipeline::run_crawl_pipeline;
use super::discovery_http_fixture::{html_route, route, DiscoveryServer};
use super::setup_config::default_crawl_config;
use super::*;
use crate::commands::run_store::{events::load, schema};
use crate::commands::site_crawler::event_recorder::EventRecorder;
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

/// Every page the loop adds is logged once, in crawl order, including fetch failures (#138).
#[tokio::test]
async fn pipeline_logs_each_crawled_page_once_in_order() {
    let mut config = default_crawl_config(Some(3));
    config.max_concurrent_requests = Some(1);
    config.max_resource_requests = Some(0);
    let server = DiscoveryServer::new(
        config,
        vec![
            route("/robots.txt", 200, "User-agent: *\nAllow: /\n"),
            html_route(
                "/",
                "<html><body><a href='/a'>a</a><a href='/gone'>gone</a></body></html>",
            ),
            html_route("/a", "<html><body><h1>A</h1></body></html>"),
            route("/gone", 503, "unavailable"),
        ],
    )
    .await;
    let dir = std::env::temp_dir().join(format!("seomi-pipeline-events-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("store.sqlite3");
    let control = CrawlControl::new();
    let run = server.setup.run_id.clone();
    control.attach_recorder(
        &run,
        EventRecorder::new(schema::open(&path).unwrap(), "p", &run),
    );
    let app = StorageApp::new(mock_builder());
    let result = run_crawl_pipeline(&app.handle(), &control, &server.setup)
        .await
        .unwrap();
    let logged = load(&schema::open(&path).unwrap(), "p", &run, 0, 50).unwrap();
    let urls: Vec<&str> = logged
        .events
        .iter()
        .filter(|event| event.kind == "page")
        .filter_map(|event| event.payload["page"]["url"].as_str())
        .collect();
    let crawled: Vec<&str> = result.pages.iter().map(|page| page.url.as_str()).collect();
    assert_eq!(urls, crawled);
    assert_eq!(
        logged.events.iter().map(|e| e.seq).collect::<Vec<_>>(),
        (1..=crawled.len() as i64).collect::<Vec<_>>()
    );
    assert_eq!(
        control.finish_recorder(&run, "completed", crawled.len()),
        None
    );
    std::fs::remove_dir_all(dir).unwrap();
}

/// `start` opens the project store and writes `started`; `finish` maps the outcome to a terminal event.
#[test]
fn event_log_start_and_finish_write_identity_and_terminal_kind() {
    use super::super::event_log::{finish, start};
    use crate::commands::run_store::commands::open_store;
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    let setup = setup(default_crawl_config(Some(2)));
    start(&app.handle(), &control, &setup, "project-a").unwrap();
    assert_eq!(finish(&control, &setup.run_id, &Err("boom".into())), None);
    let conn = open_store(&app.handle(), "project-a").unwrap();
    let events = load(&conn, "project-a", &setup.run_id, 0, 10)
        .unwrap()
        .events;
    assert_eq!(events[0].kind, "started");
    assert_eq!(
        events[0].payload["start_url"],
        setup.normalized_start_url.as_str()
    );
    assert_eq!(events[0].payload["limit"], 2);
    assert_eq!(
        (events[1].kind.as_str(), &events[1].payload),
        ("failed", &serde_json::json!({ "pages": 0 }))
    );
    assert!(
        start(&app.handle(), &control, &setup, "../escape").is_err(),
        "invalid project ids never open a store"
    );
    assert_eq!(finish(&control, "never-started", &Err("x".into())), None);
}
