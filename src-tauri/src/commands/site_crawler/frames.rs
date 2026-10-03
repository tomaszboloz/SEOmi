use super::*;

pub(super) fn crawl_frames(document: &Html, base_url: &url::Url) -> (Vec<CrawledFrame>, bool) {
    let Ok(selector) = Selector::parse("iframe") else {
        return (Vec::new(), false);
    };
    let mut frames = Vec::new();
    let mut truncated = false;
    for element in document.select(&selector) {
        if frames.len() >= MAX_IFRAMES_PER_PAGE {
            truncated = true;
            break;
        }
        let value = element.value();
        let src = value.attr("src").map(str::to_owned);
        let resolved_url = src
            .as_deref()
            .map(str::trim)
            .filter(|src| !src.is_empty())
            .and_then(|src| base_url.join(src).ok())
            .filter(|url| matches!(url.scheme(), "http" | "https"))
            .map(|url| url.to_string());
        frames.push(CrawledFrame {
            src,
            resolved_url,
            title: value.attr("title").map(str::to_owned),
            name: value.attr("name").map(str::to_owned),
            loading: value.attr("loading").map(str::to_owned),
            sandbox: value.attr("sandbox").map(str::to_owned),
            checked_in_run: false,
            http_status: None,
            request_error_kind: None,
        });
    }
    (frames, truncated)
}
