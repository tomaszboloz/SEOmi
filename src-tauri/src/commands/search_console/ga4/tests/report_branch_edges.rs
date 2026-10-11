use super::super::{models::Ga4Status, report::run_at};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;

async fn serve_responses(responses: Vec<String>) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        for body in responses {
            if let Ok((mut stream, _)) = listener.accept().await {
                let _ = super::http_fixture::read_request(&mut stream).await;
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                stream.write_all(resp.as_bytes()).await.unwrap();
                stream.shutdown().await.unwrap();
            }
        }
    });
    (addr, handle)
}

fn sample_row(path: &str) -> String {
    format!(
        r#"{{"dimensionValues":[{{"value":"{path}"}},{{"value":"example.com"}}],"metricValues":[{{"value":"1"}},{{"value":"1"}},{{"value":"1"}}]}}"#
    )
}

#[path = "report_branch_edges_part1.rs"]
mod part1;
#[path = "report_branch_edges_part2.rs"]
mod part2;
