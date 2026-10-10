use super::{session::ConnectDependencies, session_edge_fixture::Store};
use std::collections::BTreeMap;

pub(super) fn form(request: &str) -> BTreeMap<String, String> {
    url::form_urlencoded::parse(request.split_once("\r\n\r\n").unwrap().1.as_bytes())
        .into_owned()
        .collect()
}

pub(super) async fn refused_endpoint() -> (String, tokio::net::TcpSocket) {
    let socket = tokio::net::TcpSocket::new_v4().unwrap();
    socket.bind("127.0.0.1:0".parse().unwrap()).unwrap();
    (format!("http://{}", socket.local_addr().unwrap()), socket)
}

pub fn dependencies<'a>(
    store: &'a Store,
    token: &'a str,
    sites: &'a str,
) -> ConnectDependencies<'a> {
    ConnectDependencies {
        credentials: store,
        open_browser: super::session_fixture::browser_ok,
        receive_code: super::session_fixture::callback_ok,
        token_endpoint: token,
        sites_endpoint: sites,
    }
}
