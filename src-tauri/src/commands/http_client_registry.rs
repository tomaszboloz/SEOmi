//! Allow-list of registry profile and lookup URLs accepted by `fetch_registry_profile` (#87).
use crate::utils::url_validator::validate_and_normalize_url;
use url::Url;

fn wikidata_entity_id(id: &str) -> bool {
    id.starts_with('Q')
        && id.len() > 1
        && !id[1..].starts_with('0')
        && id[1..].chars().all(|char| char.is_ascii_digit())
}

fn query_value<'a>(pairs: &'a [(String, String)], key: &str) -> Option<&'a str> {
    pairs
        .iter()
        .find(|(name, _)| name.as_str() == key)
        .map(|(_, value)| value.as_str())
}

/// Only the labels/aliases lookup of one entity: `w/api.php?action=wbgetentities&ids=Q..&props=labels|aliases&format=json`.
fn wikidata_lookup_query_valid(url: &Url) -> bool {
    let pairs = url
        .query_pairs()
        .map(|(name, value)| (name.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    pairs.len() == 4
        && query_value(&pairs, "action") == Some("wbgetentities")
        && query_value(&pairs, "props") == Some("labels|aliases")
        && query_value(&pairs, "format") == Some("json")
        && query_value(&pairs, "ids").is_some_and(wikidata_entity_id)
}

pub(super) fn registry_url(raw: &str) -> Result<Url, String> {
    let url = validate_and_normalize_url(raw)
        .map_err(|error| format!("Invalid registry URL: {error}"))?;
    if url.scheme() != "https" {
        return Err("Registry evidence requires HTTPS".into());
    }
    let host = url
        .host_str()
        .unwrap_or_default()
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    let allowed_host = host == "orcid.org"
        || host.ends_with(".orcid.org")
        || host == "wikidata.org"
        || host.ends_with(".wikidata.org")
        || host == "scholar.google.com"
        || host == "researchgate.net"
        || host.ends_with(".researchgate.net")
        || host == "scopus.com";
    if !allowed_host {
        return Err("Registry host is not allow-listed".into());
    }
    if url.path() == "/" || url.path().is_empty() {
        return Err("Registry homepage is not a profile".into());
    }
    let path = url.path().trim_matches('/');
    if host == "orcid.org" || host.ends_with(".orcid.org") {
        // pub.orcid.org serves the public person record used for live identity lookup (#87).
        let id = if host == "pub.orcid.org" {
            path.strip_prefix("v3.0/")
                .and_then(|rest| rest.strip_suffix("/person"))
                .unwrap_or_default()
        } else {
            path
        };
        let valid = id.len() == 19
            && id.as_bytes().iter().enumerate().all(|(index, byte)| {
                matches!(index, 4 | 9 | 14) && *byte == b'-'
                    || index == 18 && (*byte == b'X' || byte.is_ascii_digit())
                    || !matches!(index, 4 | 9 | 14 | 18) && byte.is_ascii_digit()
            });
        if !valid {
            return Err("ORCID profile path is invalid".into());
        }
    }
    if host == "wikidata.org" || host.ends_with(".wikidata.org") {
        let valid = if path == "w/api.php" {
            wikidata_lookup_query_valid(&url)
        } else {
            (path
                .strip_prefix("wiki/")
                .or_else(|| path.strip_prefix("entity/")))
            .is_some_and(wikidata_entity_id)
        };
        if !valid {
            return Err("Wikidata entity path is invalid".into());
        }
    }
    Ok(url)
}
