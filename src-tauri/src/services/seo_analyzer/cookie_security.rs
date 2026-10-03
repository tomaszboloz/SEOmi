use crate::models::audit_data::CookieSecurityFinding;

pub fn assess_cookie_headers(headers: &[String]) -> Vec<CookieSecurityFinding> {
    headers
        .iter()
        .filter_map(|header| {
            let (pair, attributes) = header
                .split_once(';')
                .map_or((header.as_str(), ""), |(pair, rest)| (pair, rest));
            let (name, _) = pair.split_once('=')?;
            let name = name.trim();
            if name.is_empty()
                || name.len() > 128
                || !name.chars().all(|character| {
                    character.is_ascii_alphanumeric()
                        || matches!(
                            character,
                            '!' | '#'
                                | '$'
                                | '%'
                                | '&'
                                | '\''
                                | '*'
                                | '+'
                                | '-'
                                | '.'
                                | '^'
                                | '_'
                                | '`'
                                | '|'
                                | '~'
                        )
                })
            {
                return None;
            }
            let mut secure = false;
            let mut http_only = false;
            let mut same_site = None;
            for attribute in attributes
                .split(';')
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                let (key, value) = attribute
                    .split_once('=')
                    .map_or((attribute, None), |(key, value)| {
                        (key.trim(), Some(value.trim()))
                    });
                if key.eq_ignore_ascii_case("secure") {
                    secure = true;
                }
                if key.eq_ignore_ascii_case("httponly") {
                    http_only = true;
                }
                if key.eq_ignore_ascii_case("samesite") {
                    same_site = value
                        .filter(|value| {
                            matches!(
                                value.to_ascii_lowercase().as_str(),
                                "strict" | "lax" | "none"
                            )
                        })
                        .map(|value| {
                            match value.to_ascii_lowercase().as_str() {
                                "strict" => "Strict",
                                "lax" => "Lax",
                                _ => "None",
                            }
                            .to_string()
                        });
                }
            }
            Some(CookieSecurityFinding {
                name: name.to_string(),
                secure,
                http_only,
                same_site,
            })
        })
        .take(100)
        .collect()
}
