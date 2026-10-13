use std::collections::BTreeMap;

pub(crate) fn pdf_has_text(bytes: &[u8], text: &str) -> bool {
    extract_pdf_text(bytes).contains(text)
}

fn pdf_objects(bytes: &[u8]) -> Vec<(usize, String)> {
    String::from_utf8_lossy(bytes)
        .split("\nendobj\n")
        .filter_map(|chunk| {
            let (head, body) = chunk.split_once(" 0 obj\n")?;
            let id = head.rsplit('\n').next()?.parse().ok()?;
            Some((id, body.to_owned()))
        })
        .collect()
}

fn reference(body: &str, key: &str) -> Option<usize> {
    body.split_once(key)?
        .1
        .split_whitespace()
        .next()?
        .parse()
        .ok()
}

fn cmap_values(body: &str) -> BTreeMap<u16, String> {
    body.lines()
        .filter_map(|line| {
            let (left, right) = line.split_once("><")?;
            let glyph = u16::from_str_radix(left.trim_start_matches('<'), 16).ok()?;
            let raw = right.trim_end_matches('>');
            let units = raw
                .as_bytes()
                .chunks(4)
                .filter_map(|unit| u16::from_str_radix(std::str::from_utf8(unit).ok()?, 16).ok())
                .collect::<Vec<_>>();
            Some((glyph, String::from_utf16_lossy(&units)))
        })
        .collect()
}

fn hex_text(token: &str) -> Option<String> {
    let raw = token.strip_prefix('<')?.strip_suffix('>')?;
    let units = raw
        .as_bytes()
        .chunks(4)
        .filter_map(|unit| u16::from_str_radix(std::str::from_utf8(unit).ok()?, 16).ok())
        .collect::<Vec<_>>();
    Some(
        String::from_utf16_lossy(&units)
            .trim_start_matches('\u{feff}')
            .to_owned(),
    )
}

pub(crate) fn extract_pdf_text(bytes: &[u8]) -> String {
    let objects = pdf_objects(bytes);
    let by_id = objects
        .iter()
        .map(|(id, body)| (*id, body))
        .collect::<BTreeMap<_, _>>();
    let mut maps = BTreeMap::new();
    for (_, body) in &objects {
        if !body.contains("/Subtype /Type0") {
            continue;
        }
        let resource = if body.contains("/BaseFont /NotoSansCJK") {
            "F2"
        } else if body.contains("/BaseFont /NotoSansArabic") {
            "F3"
        } else {
            "F1"
        };
        if let Some(id) = reference(body, "/ToUnicode ") {
            if let Some(cmap) = by_id.get(&id) {
                maps.insert(resource, cmap_values(cmap));
            }
        }
    }
    let mut output = String::new();
    for (_, page) in objects
        .iter()
        .filter(|(_, body)| body.contains("/Type /Page"))
    {
        let Some(content_id) = reference(page, "/Contents ") else {
            continue;
        };
        let Some(content) = by_id.get(&content_id) else {
            continue;
        };
        let stream = content
            .split_once("stream\n")
            .and_then(|(_, rest)| rest.split_once("\nendstream").map(|(value, _)| value))
            .unwrap_or_default();
        let tokens = stream.split_whitespace().collect::<Vec<_>>();
        let mut resource = "F1";
        let mut actual = false;
        for (index, token) in tokens.iter().enumerate() {
            if *token == "/ActualText" {
                if let Some(value) = tokens.get(index + 1).and_then(|value| hex_text(value)) {
                    output.push_str(&value);
                    actual = true;
                }
                continue;
            }
            if *token == "EMC" {
                actual = false;
                continue;
            }
            if actual {
                continue;
            }
            if token.starts_with("/F") {
                resource = token.trim_start_matches('/');
                continue;
            }
            if !token.starts_with('<')
                || !token.ends_with('>')
                || tokens.get(index + 1).copied() != Some("Tj")
            {
                continue;
            }
            let Some(map) = maps.get(resource) else {
                continue;
            };
            for pair_hex in token.as_bytes()[1..token.len() - 1].chunks(4) {
                let Ok(raw) = std::str::from_utf8(pair_hex) else {
                    continue;
                };
                let Ok(glyph) = u16::from_str_radix(raw, 16) else {
                    continue;
                };
                if let Some(value) = map.get(&glyph) {
                    output.push_str(value);
                }
            }
        }
    }
    output
}
