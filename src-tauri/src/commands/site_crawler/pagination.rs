use super::*;

pub(super) fn pagination_query_changes(
    source_url: &url::Url,
    target_url: &url::Url,
) -> Vec<String> {
    let query_values = |url: &url::Url| {
        url.query_pairs().fold(
            HashMap::<String, Vec<String>>::new(),
            |mut values, (key, value)| {
                values.entry(key.into_owned()).or_default().push(value.into_owned());
                values
            },
        )
    };
    let source = query_values(source_url);
    let target = query_values(target_url);
    let mut keys = source.keys().chain(target.keys()).cloned().collect::<HashSet<_>>().into_iter().collect::<Vec<_>>();
    keys.sort();
    keys.into_iter()
        .filter_map(|key| {
            let old = source.get(&key);
            let new = target.get(&key);
            (old != new).then(|| {
                format!(
                    "{key}: {} → {}",
                    old.map(|v| v.join(", ")).unwrap_or_else(|| "∅".into()),
                    new.map(|v| v.join(", ")).unwrap_or_else(|| "∅".into())
                )
            })
        })
        .collect()
}

pub(super) fn crawl_pagination_links(
    document: &Html,
    final_url: &url::Url,
) -> (Vec<CrawledPaginationLink>, usize, usize) {
    let Ok(selector) = Selector::parse("link[rel], a[rel]") else {
        return (Vec::new(), 0, 0);
    };
    let mut links = Vec::new();
    let (mut declaration_count, mut invalid_declaration_count) = (0, 0);
    for element in document.select(&selector) {
        let Some(rel) = element.value().attr("rel") else { continue };
        for relation in rel.split_ascii_whitespace().filter(|v| {
            v.eq_ignore_ascii_case("next") || v.eq_ignore_ascii_case("prev")
        }) {
            declaration_count += 1;
            let target = element
                .value()
                .attr("href")
                .map(str::trim)
                .filter(|href| !href.is_empty())
                .and_then(|href| final_url.join(href).ok())
                .filter(|url| matches!(url.scheme(), "http" | "https"));
            let Some(target) = target else {
                invalid_declaration_count += 1;
                continue;
            };
            links.push(CrawledPaginationLink {
                relation: relation.to_ascii_lowercase(),
                query_parameter_changes: pagination_query_changes(final_url, &target),
                target_url: target.to_string(),
                http_status: None,
                checked_in_run: false,
                reciprocal_in_run: None,
            });
        }
    }
    (links, declaration_count, invalid_declaration_count)
}

pub(super) fn pagination_canonical_alignment(canonical_relation: &str) -> Option<String> {
    let alignment = match canonical_relation {
        "self" => "self-canonical",
        "missing" => "missing-canonical",
        "multiple" => "multiple-canonical",
        "invalid" => "invalid-canonical",
        "unavailable" => return None,
        _ => "canonical-points-elsewhere",
    };
    Some(alignment.into())
}

pub(super) fn verify_pagination_target(
    target: &mut CrawledPaginationLink,
    crawled_statuses: &HashMap<String, u16>,
) -> Option<u16> {
    let status = crawled_statuses.get(&target.target_url).copied()?;
    target.http_status = Some(status);
    target.checked_in_run = true;
    Some(status)
}

pub(super) fn opposite_pagination_relation(relation: &str) -> Option<&'static str> {
    match relation.to_ascii_lowercase().as_str() {
        "next" => Some("prev"),
        "prev" => Some("next"),
        _ => None,
    }
}

pub(super) fn pagination_edges(pages: &[CrawledPageSummary]) -> HashSet<(String, String, String)> {
    let mut edges = HashSet::new();
    for page in pages {
        let source_keys = [page.url.as_str(), page.final_url.as_str()]
            .into_iter()
            .filter_map(canonical_identity_url)
            .map(|url| url.to_string())
            .collect::<Vec<_>>();
        for link in &page.pagination_links {
            let Some(target) = canonical_identity_url(&link.target_url).map(|url| url.to_string()) else {
                continue;
            };
            let relation = link.relation.to_ascii_lowercase();
            for source in &source_keys {
                edges.insert((source.clone(), relation.clone(), target.clone()));
            }
        }
    }
    edges
}
