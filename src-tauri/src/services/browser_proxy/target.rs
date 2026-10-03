use super::types::*;
use url::Url;

pub(super) fn parse_proxy_target(
    method: String,
    target: String,
    headers: Vec<(String, String)>,
    content_length: usize,
    body: &[u8],
) -> Result<ProxyTarget, u16> {
    if method.eq_ignore_ascii_case("CONNECT") {
        let parsed = Url::parse(&format!("https://{target}/")).map_err(|_| 400_u16)?;
        let host = parsed.host_str().ok_or(400_u16)?.to_ascii_lowercase();
        let port = parsed.port().unwrap_or(443);
        if parsed.path() != "/"
            || parsed.query().is_some()
            || parsed.fragment().is_some()
            || target.contains('@')
            || !parsed.username().is_empty()
            || parsed.password().is_some()
            || content_length != 0
            || !body.is_empty()
        {
            return Err(400);
        }
        Ok(ProxyTarget::Connect { host, port })
    } else {
        if !method.eq_ignore_ascii_case("GET") && !method.eq_ignore_ascii_case("HEAD") {
            return Err(405);
        }
        let url = Url::parse(&target).map_err(|_| 400_u16)?;
        if url.scheme() != "http"
            || !url.username().is_empty()
            || url.password().is_some()
            || authority_contains_userinfo(&target)
            || content_length != 0
            || !body.is_empty()
        {
            return Err(400);
        }
        Ok(ProxyTarget::Http {
            method: method.to_ascii_uppercase(),
            url,
            headers,
        })
    }
}

pub(super) fn authority_contains_userinfo(target: &str) -> bool {
    let Some((_, remainder)) = target.split_once("://") else {
        return false;
    };
    remainder
        .split(['/', '?', '#'])
        .next()
        .is_some_and(|authority| authority.contains('@'))
}
