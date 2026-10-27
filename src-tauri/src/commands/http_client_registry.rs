use crate::utils::url_validator::validate_and_normalize_url;
use url::Url;

pub(super) fn registry_url(raw: &str) -> Result<Url, String> {
    let url = validate_and_normalize_url(raw)
        .map_err(|error| format!("Invalid registry URL: {error}"))?;
    if url.scheme() != "https" || url.port().is_some_and(|port| port != 443) {
        return Err("Registry evidence requires HTTPS".into());
    }
    let host = url
        .host_str()
        .unwrap_or_default()
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    let allowed = host == "orcid.org"
        || host.ends_with(".orcid.org")
        || host == "wikidata.org"
        || host.ends_with(".wikidata.org")
        || host == "scholar.google.com"
        || host == "researchgate.net"
        || host.ends_with(".researchgate.net")
        || host == "scopus.com";
    if !allowed {
        return Err("Registry host is not allow-listed".into());
    }
    if url.path() == "/" || url.path().is_empty() {
        return Err("Registry homepage is not a profile".into());
    }
    let path = url.path().trim_matches('/');
    if host == "orcid.org" || host.ends_with(".orcid.org") {
        if url.query().is_some() || url.fragment().is_some() {
            return Err("Structured ORCID URL cannot contain query or fragment".into());
        }
        let valid = path.len() == 19
            && path.as_bytes().iter().enumerate().all(|(index, byte)| {
                matches!(index, 4 | 9 | 14) && *byte == b'-'
                    || index == 18 && (*byte == b'X' || byte.is_ascii_digit())
                    || !matches!(index, 4 | 9 | 14 | 18) && byte.is_ascii_digit()
            })
            && orcid_checksum_valid(path);
        if !valid {
            return Err("ORCID profile path is invalid".into());
        }
    }
    if host == "wikidata.org" || host.ends_with(".wikidata.org") {
        if url.query().is_some() || url.fragment().is_some() {
            return Err("Structured Wikidata URL cannot contain query or fragment".into());
        }
        let valid = path
            .strip_prefix("wiki/")
            .or_else(|| path.strip_prefix("entity/"))
            .is_some_and(|id| {
                id.starts_with('Q')
                    && id.len() > 1
                    && !id[1..].starts_with('0')
                    && id[1..].chars().all(|char| char.is_ascii_digit())
            });
        if !valid {
            return Err("Wikidata entity path is invalid".into());
        }
    }
    Ok(url)
}

fn orcid_checksum_valid(id: &str) -> bool {
    let digits: Vec<char> = id.chars().filter(|char| *char != '-').collect();
    if digits.len() != 16 || !digits[..15].iter().all(|char| char.is_ascii_digit()) {
        return false;
    }
    let total = digits[..15]
        .iter()
        .fold(0u32, |sum, digit| (sum + digit.to_digit(10).unwrap()) * 2);
    let check = (12 - (total % 11)) % 11;
    let expected = if check == 10 {
        'X'
    } else {
        char::from_digit(check, 10).unwrap()
    };
    digits[15] == expected
}

pub(super) fn registry_api_url(profile: &Url) -> Option<Url> {
    let host = profile
        .host_str()
        .unwrap_or_default()
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    let path = profile.path().trim_matches('/');
    let target = if host == "orcid.org" || host.ends_with(".orcid.org") {
        format!("https://pub.orcid.org/v3.0/{path}")
    } else if host == "wikidata.org" || host.ends_with(".wikidata.org") {
        let id = path
            .strip_prefix("wiki/")
            .or_else(|| path.strip_prefix("entity/"))?;
        format!("https://www.wikidata.org/wiki/Special:EntityData/{id}.json")
    } else {
        return None;
    };
    Url::parse(&target).ok()
}
