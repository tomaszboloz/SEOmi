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
        "google-suggestions" if !keyword.trim().is_empty() => {
            Url::parse("https://suggestqueries.google.com/complete/search").unwrap()
        }
        "bing-serp" if !keyword.trim().is_empty() => {
            Url::parse("https://www.bing.com/search").unwrap()
        }
        "wikidata-entities" if !keyword.trim().is_empty() => {
            Url::parse("https://www.wikidata.org/w/api.php").unwrap()
        }
        "bing-serp" => return Err("Bing RSS requires a keyword.".into()),
        _ => return Err("Unsupported public feed.".into()),
    };
    if feed == "google-trends" {
        url.query_pairs_mut()
            .append_pair("geo", &geo.to_ascii_uppercase());
    } else if feed == "wikidata-entities" {
        // Language-independent entity IDs (#99, #110): label search in the page language.
        let primary = language.split('-').next().unwrap_or(language);
        url.query_pairs_mut()
            .clear()
            .append_pair("action", "wbsearchentities")
            .append_pair("format", "json")
            .append_pair("type", "item")
            .append_pair("limit", "5")
            .append_pair("language", &primary.to_ascii_lowercase())
            .append_pair("uselang", &primary.to_ascii_lowercase())
            .append_pair("search", keyword.trim());
    } else if feed == "google-suggestions" {
        let mut query = url.query_pairs_mut();
        query
            .clear()
            .append_pair("client", "firefox")
            .append_pair("hl", &language.to_ascii_lowercase())
            .append_pair("gl", &geo.to_ascii_lowercase())
            .append_pair("q", keyword.trim());
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

#[cfg(test)]
mod tests {
    use super::public_feed_url;

    #[test]
    fn google_suggestions_use_fixed_endpoint_and_lowercase_locale() {
        let url = public_feed_url("google-suggestions", "PL", " seo & test ", "PL-pl").unwrap();
        assert_eq!(url.host_str(), Some("suggestqueries.google.com"));
        assert_eq!(url.path(), "/complete/search");
        assert_eq!(
            url.query_pairs().collect::<Vec<_>>(),
            vec![
                ("client".into(), "firefox".into()),
                ("hl".into(), "pl-pl".into()),
                ("gl".into(), "pl".into()),
                ("q".into(), "seo & test".into()),
            ]
        );
    }

    #[test]
    fn google_suggestions_require_keyword_and_reject_unknown_or_bad_geo() {
        assert!(public_feed_url("google-suggestions", "PL", "", "pl").is_err());
        assert!(public_feed_url("unknown", "PL", "query", "pl").is_err());
        assert!(public_feed_url("google-suggestions", "POL", "query", "pl").is_err());
    }

    #[test]
    fn wikidata_entities_use_fixed_endpoint_and_primary_language() {
        let url = public_feed_url("wikidata-entities", "DE", " Kaffeemühle ", "de-AT").unwrap();
        assert_eq!(url.host_str(), Some("www.wikidata.org"));
        assert_eq!(url.path(), "/w/api.php");
        let pairs = url.query_pairs().collect::<Vec<_>>();
        assert!(pairs.contains(&("action".into(), "wbsearchentities".into())));
        assert!(pairs.contains(&("language".into(), "de".into())));
        assert!(pairs.contains(&("search".into(), "Kaffeemühle".into())));
        assert!(public_feed_url("wikidata-entities", "DE", "  ", "de").is_err());
    }
}
