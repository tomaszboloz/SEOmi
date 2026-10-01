use super::*;

pub(super) fn html_meta_charset(body: &[u8]) -> Option<String> {
    let prefix = String::from_utf8_lossy(&body[..body.len().min(4096)]).to_ascii_lowercase();
    let marker = "charset";
    let start = prefix.find(marker)? + marker.len();
    let tail =
        prefix[start..].trim_start_matches(|character: char| character.is_ascii_whitespace());
    let tail = tail
        .strip_prefix('=')?
        .trim_start_matches(|character: char| character.is_ascii_whitespace());
    let quote = tail
        .chars()
        .next()
        .filter(|character| *character == '\'' || *character == '"');
    let value = if let Some(quote) = quote {
        let value = &tail[quote.len_utf8()..];
        value.split(quote).next()?
    } else {
        tail.split(|character: char| {
            character.is_ascii_whitespace() || character == ';' || character == '>'
        })
        .next()?
    };
    (!value.is_empty()).then(|| value.to_string())
}

pub(super) fn html_encoding_finding(code: &str, message: String) -> CrawledHtmlValidationFinding {
    CrawledHtmlValidationFinding {
        code: code.into(),
        severity: "Warning".into(),
        message,
        element: None,
        attribute: None,
        value: None,
        line: None,
        column: None,
        source_excerpt: None,
    }
}

pub(super) fn decode_crawl_html_body(
    body: &[u8],
    http_charset: Option<&str>,
) -> (String, Option<String>, Vec<CrawledHtmlValidationFinding>) {
    let mut findings = Vec::new();
    let document_declared_charset_source = if http_charset.is_none() {
        html_meta_charset(body)
    } else {
        None
    };
    let (encoding, bom_length) = if let Some((encoding, length)) =
        encoding_rs::Encoding::for_bom(body)
    {
        (encoding, length)
    } else {
        let declared = http_charset
            .map(str::trim)
            .filter(|label| !label.is_empty())
            .map(|label| label.trim_matches(['\'', '"']).to_string())
            .or_else(|| html_meta_charset(body));
        match declared {
            Some(label) => match encoding_rs::Encoding::for_label(label.as_bytes()) {
                Some(encoding) => (encoding, 0),
                None => {
                    let mut finding = html_encoding_finding(
                        "encoding-unsupported-label",
                        format!("Nieobsługiwana deklaracja kodowania: {label}. Zastosowano UTF-8 jako fallback."),
                    );
                    if document_declared_charset_source.is_some() {
                        let source = String::from_utf8_lossy(body).into_owned();
                        let source_lower = source.to_ascii_lowercase();
                        if let Some(offset) = source_lower.find("charset") {
                            set_html_finding_source(&mut finding, &source, offset);
                        }
                    }
                    findings.push(finding);
                    (encoding_rs::UTF_8, 0)
                }
            },
            None => (encoding_rs::UTF_8, 0),
        }
    };
    let (decoded, _, had_errors) = encoding.decode(&body[bom_length..]);
    let decoded = decoded.into_owned();
    if had_errors {
        let mut finding = html_encoding_finding(
            "encoding-invalid-byte-sequence",
            format!("Dekodowanie {} zawierało nieprawidłową sekwencję bajtów; dekoder zastąpił ją znakiem zastępczym.", encoding.name()),
        );
        if let Some(offset) = decoded.find('\u{FFFD}') {
            set_html_finding_source(&mut finding, &decoded, offset);
        }
        findings.push(finding);
    }
    (decoded, Some(encoding.name().to_string()), findings)
}

pub(super) fn is_valid_percent_encoding(value: &str) -> bool {
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len()
                || !bytes[index + 1].is_ascii_hexdigit()
                || !bytes[index + 2].is_ascii_hexdigit()
            {
                return false;
            }
            index += 3;
        } else {
            index += 1;
        }
    }
    true
}

pub(super) fn push_html_validation_finding(
    findings: &mut Vec<CrawledHtmlValidationFinding>,
    truncated: &mut bool,
    finding: CrawledHtmlValidationFinding,
) {
    if findings.len() < MAX_HTML_VALIDATION_FINDINGS_PER_PAGE {
        findings.push(finding);
    } else {
        *truncated = true;
    }
}

pub(super) fn locate_html_attribute(
    source: &str,
    source_lower: &str,
    element: &str,
    attribute: &str,
    expected_value: &str,
    occurrence: usize,
) -> Option<usize> {
    let opening = format!("<{}", element.to_ascii_lowercase());
    let mut search_from = 0usize;
    let mut matched = 0usize;
    while let Some(relative) = source_lower.get(search_from..)?.find(&opening) {
        let tag_start = search_from + relative;
        let after_name = tag_start + opening.len();
        if source_lower[after_name..]
            .chars()
            .next()
            .is_some_and(|character| {
                !(character.is_ascii_whitespace() || character == '/' || character == '>')
            })
        {
            search_from = after_name;
            continue;
        }
        let mut quote = None;
        let mut tag_end = None;
        for (offset, character) in source[after_name..].char_indices() {
            if let Some(active) = quote {
                if character == active {
                    quote = None;
                }
            } else if character == '\'' || character == '"' {
                quote = Some(character);
            } else if character == '>' {
                tag_end = Some(after_name + offset);
                break;
            }
        }
        let tag_end = tag_end?;
        let tag = &source[after_name..tag_end];
        let tag_lower = tag.to_ascii_lowercase();
        let mut cursor = 0usize;
        while let Some(relative_attribute) = tag_lower
            .get(cursor..)?
            .find(&attribute.to_ascii_lowercase())
        {
            let name_start = cursor + relative_attribute;
            let name_end = name_start + attribute.len();
            let before_ok = name_start == 0 || tag.as_bytes()[name_start - 1].is_ascii_whitespace();
            let after_ok = tag
                .as_bytes()
                .get(name_end)
                .map_or(true, |byte| byte.is_ascii_whitespace() || *byte == b'=');
            if !before_ok || !after_ok {
                cursor = name_end;
                continue;
            }
            cursor = name_end;
            while tag[cursor..]
                .chars()
                .next()
                .is_some_and(|character| character.is_ascii_whitespace())
            {
                cursor += tag[cursor..].chars().next()?.len_utf8();
            }
            if tag.as_bytes().get(cursor) != Some(&b'=') {
                continue;
            }
            cursor += 1;
            while tag[cursor..]
                .chars()
                .next()
                .is_some_and(|character| character.is_ascii_whitespace())
            {
                cursor += tag[cursor..].chars().next()?.len_utf8();
            }
            let (value_start, value_end) =
                if let Some(quote @ ('\'' | '"')) = tag[cursor..].chars().next() {
                    cursor += quote.len_utf8();
                    let value_start = cursor;
                    while tag[cursor..]
                        .chars()
                        .next()
                        .is_some_and(|character| character != quote)
                    {
                        cursor += tag[cursor..].chars().next()?.len_utf8();
                    }
                    (value_start, cursor)
                } else {
                    let value_start = cursor;
                    while tag[cursor..].chars().next().is_some_and(|character| {
                        !character.is_ascii_whitespace() && character != '>'
                    }) {
                        cursor += tag[cursor..].chars().next()?.len_utf8();
                    }
                    (value_start, cursor)
                };
            if tag[value_start..value_end] == *expected_value {
                if matched == occurrence {
                    return Some(after_name + value_start);
                }
                matched += 1;
            }
            break;
        }
        search_from = tag_end + 1;
    }
    None
}

pub(super) fn set_html_finding_source(
    finding: &mut CrawledHtmlValidationFinding,
    source: &str,
    offset: usize,
) {
    let offset = offset.min(source.len());
    let prefix = &source[..offset];
    let line_start = prefix.rfind('\n').map_or(0, |index| index + 1);
    let line_end = source[offset..]
        .find('\n')
        .map_or(source.len(), |index| offset + index);
    let mut excerpt_start = line_start.max(offset.saturating_sub(100));
    let mut excerpt_end = line_end.min(offset.saturating_add(140));
    while !source.is_char_boundary(excerpt_start) {
        excerpt_start += 1;
    }
    while !source.is_char_boundary(excerpt_end) {
        excerpt_end -= 1;
    }
    finding.line = Some(prefix.bytes().filter(|byte| *byte == b'\n').count() + 1);
    finding.column = Some(source[line_start..offset].chars().count() + 1);
    finding.source_excerpt = Some(source[excerpt_start..excerpt_end].trim().to_string());
}

pub(super) fn document_declares_meta_charset(document: &Html) -> bool {
    let Ok(meta_selector) = Selector::parse("meta") else {
        return false;
    };
    document.select(&meta_selector).any(|meta| {
        if meta
            .value()
            .attr("charset")
            .is_some_and(|value| !value.trim().is_empty())
        {
            return true;
        }
        meta.value()
            .attr("http-equiv")
            .is_some_and(|value| value.trim().eq_ignore_ascii_case("content-type"))
            && meta.value().attr("content").is_some_and(|value| {
                value
                    .to_ascii_lowercase()
                    .split(';')
                    .any(|part| part.trim_start().starts_with("charset="))
            })
    })
}

pub(super) fn validate_crawl_html_with_charset(
    document: &Html,
    decoded_html: &str,
    base_url: &url::Url,
    http_charset: Option<&str>,
) -> (Vec<CrawledHtmlValidationFinding>, bool) {
    let mut findings = Vec::new();
    let mut truncated = false;
    let raw_lower = decoded_html.to_ascii_lowercase();
    let doctype_declarations = raw_lower
        .match_indices("<!doctype")
        .map(|(offset, _)| {
            let declaration_end = raw_lower[offset..]
                .find('>')
                .map_or(raw_lower.len(), |relative| offset + relative + 1);
            (offset, declaration_end)
        })
        .collect::<Vec<_>>();
    let is_html_doctype = |(offset, end): &(usize, usize)| {
        let declaration = raw_lower[offset + "<!doctype".len()..*end].trim_start();
        declaration.strip_prefix("html").is_some_and(|tail| {
            tail.is_empty() || tail.starts_with('>') || tail.starts_with(char::is_whitespace)
        })
    };
    if doctype_declarations.is_empty() {
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-doctype-missing".into(),
            severity: "Warning".into(),
            message: "Nie wykryto deklaracji <!doctype html>; przeglądarka może użyć trybu quirks."
                .into(),
            element: Some("html".into()),
            attribute: None,
            value: None,
            line: None,
            column: None,
            source_excerpt: None,
        };
        if !decoded_html.is_empty() {
            set_html_finding_source(&mut finding, decoded_html, 0);
        }
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    } else if !doctype_declarations.iter().any(is_html_doctype) {
        let (offset, end) = doctype_declarations[0];
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-doctype-invalid".into(),
            severity: "Warning".into(),
            message: "Wykryta deklaracja doctype nie wskazuje dokumentu HTML5.".into(),
            element: Some("!doctype".into()),
            attribute: None,
            value: Some(decoded_html[offset..end].chars().take(240).collect()),
            line: None,
            column: None,
            source_excerpt: None,
        };
        set_html_finding_source(&mut finding, decoded_html, offset);
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    }
    if doctype_declarations.len() > 1 {
        let (offset, end) = doctype_declarations[1];
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-doctype-duplicate".into(),
            severity: "Warning".into(),
            message: "Dokument zawiera więcej niż jedną deklarację doctype.".into(),
            element: Some("!doctype".into()),
            attribute: None,
            value: Some(decoded_html[offset..end].chars().take(240).collect()),
            line: None,
            column: None,
            source_excerpt: None,
        };
        set_html_finding_source(&mut finding, decoded_html, offset);
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    }

    let html_selector = Selector::parse("html").expect("valid html selector");
    let html_element = document.select(&html_selector).next();
    let document_language = html_element
        .and_then(|element| element.value().attr("lang"))
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if document_language.is_none() {
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-lang-missing".into(),
            severity: "Warning".into(),
            message: "Nie wykryto niepustego atrybutu lang na elemencie html; technologie asystujące mogą błędnie dobrać język wymowy.".into(),
            element: Some("html".into()),
            attribute: Some("lang".into()),
            value: None,
            line: None,
            column: None,
            source_excerpt: None,
        };
        if let Some(offset) = raw_lower.find("<html") {
            set_html_finding_source(&mut finding, decoded_html, offset);
        } else if !decoded_html.is_empty() {
            set_html_finding_source(&mut finding, decoded_html, 0);
        }
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    }

    if http_charset.is_none() && !document_declares_meta_charset(document) {
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-meta-charset-missing".into(),
            severity: "Warning".into(),
            message: "Nie wykryto deklaracji charsetu w dokumencie HTML ani w nagłówku HTTP; dekodowanie może zależeć od heurystyki.".into(),
            element: Some("meta".into()),
            attribute: Some("charset".into()),
            value: None,
            line: None,
            column: None,
            source_excerpt: None,
        };
        if let Some(offset) = raw_lower.find("<head") {
            set_html_finding_source(&mut finding, decoded_html, offset);
        } else if let Some(offset) = raw_lower.find("<html") {
            set_html_finding_source(&mut finding, decoded_html, offset);
        } else if !decoded_html.is_empty() {
            set_html_finding_source(&mut finding, decoded_html, 0);
        }
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    }

    let Ok(all_elements) = Selector::parse("*") else {
        return (findings, truncated);
    };
    let mut seen_ids = HashSet::new();
    let mut id_tag_occurrences = HashMap::<(String, String), usize>::new();
    let mut uri_occurrences = HashMap::<(String, String, String), usize>::new();
    let source_lower = decoded_html.to_ascii_lowercase();
    let mut checked_uris = 0usize;
    const MAX_URI_REFERENCES_PER_PAGE: usize = 20_000;
    const URI_ATTRIBUTES: [&str; 9] = [
        "href",
        "src",
        "action",
        "formaction",
        "poster",
        "cite",
        "data",
        "manifest",
        "xlink:href",
    ];
    for element in document.select(&all_elements) {
        if let Some(id) = element
            .value()
            .attr("id")
            .map(str::trim)
            .filter(|id| !id.is_empty())
        {
            let element_name = element.value().name().to_string();
            let occurrence = id_tag_occurrences
                .entry((element_name.clone(), id.to_string()))
                .or_default();
            let tag_occurrence = *occurrence;
            *occurrence += 1;
            if !seen_ids.insert(id.to_string()) {
                let mut finding = CrawledHtmlValidationFinding {
                    code: "html-duplicate-id".into(),
                    severity: "Warning".into(),
                    message: "Wartość id nie jest unikalna w dokumencie.".into(),
                    element: Some(element.value().name().to_string()),
                    attribute: Some("id".into()),
                    value: Some(id.chars().take(240).collect()),
                    line: None,
                    column: None,
                    source_excerpt: None,
                };
                if let Some(offset) = locate_html_attribute(
                    decoded_html,
                    &source_lower,
                    &element_name,
                    "id",
                    id,
                    tag_occurrence,
                ) {
                    set_html_finding_source(&mut finding, decoded_html, offset);
                }
                push_html_validation_finding(&mut findings, &mut truncated, finding);
            }
        }
        for (attribute, value) in element.value().attrs() {
            if !URI_ATTRIBUTES.contains(&attribute) || value.trim().is_empty() {
                continue;
            }
            checked_uris += 1;
            if checked_uris > MAX_URI_REFERENCES_PER_PAGE {
                truncated = true;
                break;
            }
            let value = value.trim();
            if value.starts_with('#')
                || value.contains("{{")
                || value.contains("${")
                || value.starts_with("<%")
            {
                continue;
            }
            let has_valid_scheme = [
                "mailto:",
                "tel:",
                "javascript:",
                "data:",
                "blob:",
                "about:",
                "ftp:",
            ]
            .iter()
            .any(|scheme| value.to_ascii_lowercase().starts_with(scheme));
            let malformed = value.contains(char::is_whitespace)
                || !is_valid_percent_encoding(value)
                || (!has_valid_scheme && base_url.join(value).is_err());
            if malformed {
                let occurrence_key = (
                    element.value().name().to_string(),
                    attribute.to_string(),
                    value.to_string(),
                );
                let occurrence = uri_occurrences.entry(occurrence_key).or_default();
                let mut finding = CrawledHtmlValidationFinding {
                        code: "html-uri-invalid".into(),
                        severity: "Warning".into(),
                        message: "Wartość atrybutu URI ma niepoprawne kodowanie procentowe lub nie daje się rozwiązać względem URL strony.".into(),
                        element: Some(element.value().name().to_string()),
                        attribute: Some(attribute.to_string()),
                        value: Some(value.chars().take(240).collect()),
                        line: None,
                        column: None,
                        source_excerpt: None,
                    };
                if let Some(offset) = locate_html_attribute(
                    decoded_html,
                    &source_lower,
                    element.value().name(),
                    attribute,
                    value,
                    *occurrence,
                ) {
                    set_html_finding_source(&mut finding, decoded_html, offset);
                }
                push_html_validation_finding(&mut findings, &mut truncated, finding);
                *occurrence += 1;
            }
        }
        if checked_uris > MAX_URI_REFERENCES_PER_PAGE {
            break;
        }
    }
    (findings, truncated)
}
