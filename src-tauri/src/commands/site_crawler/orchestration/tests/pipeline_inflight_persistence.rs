use super::super::pipeline::run_crawl_pipeline;
use super::discovery_http_fixture::{delayed_route, html_route, route, DiscoveryServer};
use super::setup_config::default_crawl_config;
use super::*;
use crate::commands::run_store::commands::open_store;
use crate::commands::run_store::events::load_events;
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

#[tokio::test]
async fn test_production_pipeline_persists_in_flight_pages_to_sqlite() {
    let mut config = default_crawl_config(Some(5));
    config.max_concurrent_requests = Some(1);
    config.max_resource_requests = Some(0);

    let routes = vec![
        route("/robots.txt", 200, "User-agent: *\nAllow: /\n"),
        html_route(
            "/",
            "<html><body><a href='/p1'>1</a><a href='/p2'>2</a></body></html>",
        ),
        html_route("/p1", "<html><body><h1>1</h1></body></html>"),
        delayed_route("/p2", 200, "<html><body><h1>2</h1></body></html>", 800),
    ];
    let mut server = DiscoveryServer::new(config, routes).await;
    let app = StorageApp::new(mock_builder());
    let pid = format!("proj-pipe-{}", uuid::Uuid::new_v4());
    let rid = "run-pipe-live".to_string();
    server.setup.project_id = Some(pid.clone());
    server.setup.run_id = rid.clone();

    let control = CrawlControl::new();
    let handle = app.handle();
    let crawl = run_crawl_pipeline(&handle, &control, &server.setup);
    let inspector = async {
        let conn_inflight = open_store(&handle, &pid).expect("open inflight store");
        let mut in_flight_events = Vec::new();
        for _ in 0..40 {
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
            if let Ok(ev) = load_events(&conn_inflight, &pid, &rid, 1, 20) {
                if ev.iter().filter(|e| e.event_type == "crawl:page").count() >= 2 {
                    in_flight_events = ev;
                    break;
                }
            }
        }
        assert!(in_flight_events.len() >= 3);
        assert_eq!(in_flight_events[0].event_type, "crawl:started");
        let page_events: Vec<_> = in_flight_events
            .iter()
            .filter(|e| e.event_type == "crawl:page")
            .collect();
        assert!(page_events.len() >= 2);
        assert_eq!(page_events[0].payload["provenance"], "live-crawl");
        assert!(in_flight_events
            .iter()
            .all(|e| e.event_type != "crawl:completed"));
        assert_eq!(
            load_events(&conn_inflight, "other-pid", &rid, 1, 20)
                .unwrap()
                .len(),
            0
        );
    };

    let (crawl_result, _) = tokio::join!(crawl, inspector);
    assert!(crawl_result.unwrap().pages.len() >= 3);

    let conn_final = open_store(&handle, &pid).expect("open final store");
    let complete_events = load_events(&conn_final, &pid, &rid, 1, 20).expect("load final");
    let final_event = complete_events.last().expect("must have final event");
    assert_eq!(final_event.event_type, "crawl:completed");
    assert_eq!(final_event.payload["provenance"], "live-crawl");
    assert!(final_event.payload["pageCount"].as_u64().unwrap() >= 3);
}

#[tokio::test]
async fn test_production_pipeline_persists_cancellation_to_sqlite() {
    let mut config = default_crawl_config(Some(5));
    config.max_concurrent_requests = Some(1);
    config.max_resource_requests = Some(0);

    let routes = vec![
        route("/robots.txt", 200, "User-agent: *\nAllow: /\n"),
        html_route(
            "/",
            "<html><body><a href='/delayed'>delayed</a></body></html>",
        ),
        delayed_route(
            "/delayed",
            200,
            "<html><body><h1>Delayed</h1></body></html>",
            600,
        ),
    ];
    let mut server = DiscoveryServer::new(config, routes).await;
    let app = StorageApp::new(mock_builder());
    let pid = format!("proj-cancel-{}", uuid::Uuid::new_v4());
    let rid = "run-cancel-live".to_string();
    server.setup.project_id = Some(pid.clone());
    server.setup.run_id = rid.clone();

    let control = CrawlControl::new();
    let handle = app.handle();
    let crawl = run_crawl_pipeline(&handle, &control, &server.setup);
    let canceller = async {
        for _ in 0..40 {
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
            if let Ok(conn) = open_store(&handle, &pid) {
                if let Ok(ev) = load_events(&conn, &pid, &rid, 1, 10) {
                    if ev.iter().any(|e| e.event_type == "crawl:page") {
                        break;
                    }
                }
            }
        }
        control.cancelled_runs.lock().unwrap().insert(rid.clone());
    };

    let (crawl_result, _) = tokio::join!(crawl, canceller);
    assert!(crawl_result.unwrap().cancelled);

    let conn = open_store(&handle, &pid).expect("open cancel store");
    let events = load_events(&conn, &pid, &rid, 1, 20).expect("load cancel events");
    let cancel_event = events
        .iter()
        .find(|e| e.event_type == "crawl:cancelled")
        .unwrap();
    assert_eq!(cancel_event.payload["cancelled"], true);
    assert_eq!(cancel_event.payload["provenance"], "live-crawl");
}
