use url::Url;

fn valid_geo(value: &str) -> bool {
    value.len() == 2 && value.bytes().all(|byte| byte.is_ascii_alphabetic())
}
fn valid_language(value: &str) -> bool {
    let segments: Vec<&str> = value.split('-').collect();
    (segments.len() == 1 || segments.len() == 2)
        && segments.iter().all(|segment| {
            (2..=8).contains(&segment.len())
                && segment.bytes().all(|byte| byte.is_ascii_alphabetic())
        })
}

pub(super) fn public_feed_url(
    feed: &str,
    geo: &str,
    keyword: &str,
    language: &str,
) -> Result<Url, String> {
    if !valid_geo(geo) {
        return Err("Public feed requires a two-letter country.".into());
    }
    if !valid_language(language) {
        return Err("Public feed requires a valid language.".into());
    }
    if keyword.len() > 500 {
        return Err("Public feed keyword is too long.".into());
    }
    let mut url = match feed {
        "google-trends" => Url::parse("https://trends.google.com/trending/rss").unwrap(),
        "bing-serp" if !keyword.trim().is_empty() => {
            Url::parse("https://www.bing.com/search").unwrap()
        }
        "bing-serp" => return Err("Bing RSS requires a keyword.".into()),
        _ => return Err("Unsupported public feed.".into()),
    };
    if feed == "google-trends" {
        url.query_pairs_mut()
            .append_pair("geo", &geo.to_ascii_uppercase());
    } else {
        let mut query = url.query_pairs_mut();
        query
            .clear()
            .append_pair("format", "rss")
            .append_pair("q", keyword.trim())
            .append_pair("setlang", &language.to_ascii_lowercase())
            .append_pair("cc", &geo.to_ascii_uppercase());
    }
    Ok(url)
}
