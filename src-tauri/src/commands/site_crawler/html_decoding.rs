use super::*;

pub(super) fn html_meta_charset(body: &[u8]) -> Option<String> {
    let prefix = String::from_utf8_lossy(&body[..body.len().min(4096)]).to_ascii_lowercase();
    let marker = "charset";
    let start = prefix.find(marker)? + marker.len();
    let tail = prefix[start..].trim_start_matches(|c: char| c.is_ascii_whitespace());
    let tail = tail
        .strip_prefix('=')?
        .trim_start_matches(|c: char| c.is_ascii_whitespace());
    let quote = tail.chars().next().filter(|c| *c == '\'' || *c == '"');
    let value = if let Some(quote) = quote {
        let value = &tail[quote.len_utf8()..];
        value.split(quote).next()?
    } else {
        tail.split(|c: char| c.is_ascii_whitespace() || c == ';' || c == '>')
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
