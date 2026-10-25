//! Deterministic local HTTP fixture server for desktop E2E testing.
//! Serves illustrative HTML, robots.txt and favicon without external network calls.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};

const FIXTURE_HTML: &str = "<!doctype html>\n<html>\n<head>\n    <title>Example Domain</title>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n</head>\n<body>\n<div>\n    <h1>Example Domain</h1>\n    <p>This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.</p>\n</div>\n</body>\n</html>";
const ROBOTS_TXT: &str = "User-agent: *\nAllow: /\n";

pub struct DesktopFixture {
    socket: SocketAddr,
    shutdown: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl DesktopFixture {
    pub fn start() -> Self {
        let listener =
            TcpListener::bind(("127.0.0.1", 0)).expect("bind desktop E2E fixture server");
        let socket = listener.local_addr().expect("fixture local address");
        seomi_lib::utils::test_fixture::register_test_fixture_socket(socket);
        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_flag = shutdown.clone();

        let handle = thread::spawn(move || {
            while let Ok((mut stream, _)) = listener.accept() {
                if shutdown_flag.load(Ordering::Relaxed) {
                    break;
                }
                let mut buffer = [0u8; 2048];
                let count = stream.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..count]);
                let path = request.split_whitespace().nth(1).unwrap_or("/");

                let (status, ctype, body) = match path {
                    "/" | "/index.html" => ("200 OK", "text/html; charset=utf-8", FIXTURE_HTML),
                    "/robots.txt" => ("200 OK", "text/plain; charset=utf-8", ROBOTS_TXT),
                    "/favicon.ico" => ("204 No Content", "text/plain", ""),
                    _ => ("404 Not Found", "text/plain; charset=utf-8", "Not Found"),
                };

                let response = format!(
                    "HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(response.as_bytes());
            }
        });

        Self {
            socket,
            shutdown,
            handle: Some(handle),
        }
    }

    pub fn url(&self) -> String {
        format!("http://{}/", self.socket)
    }
}

impl Drop for DesktopFixture {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
        let _ = TcpStream::connect(self.socket);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
        seomi_lib::utils::test_fixture::clear_test_fixture_socket();
    }
}
