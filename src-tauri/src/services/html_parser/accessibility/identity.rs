use super::*;

pub(in crate::services::html_parser) struct IdentityInventory {
    pub(in crate::services::html_parser) landmark_counts: std::collections::BTreeMap<String, usize>,
    pub(in crate::services::html_parser) aria_attribute_count: usize,
    pub(in crate::services::html_parser) ids: HashSet<String>,
    pub(in crate::services::html_parser) nonempty_id_names: HashSet<String>,
    pub(in crate::services::html_parser) duplicate_id_values: HashSet<String>,
    pub(in crate::services::html_parser) duplicate_id_count: usize,
    pub(in crate::services::html_parser) duplicate_ids: Vec<String>,
    pub(in crate::services::html_parser) unresolved_aria_reference_count: usize,
    pub(in crate::services::html_parser) unresolved_aria_references: Vec<(&'static str, String)>,
}

pub(in crate::services::html_parser) fn identity_inventory(document: &Html) -> IdentityInventory {
    let all_elements_selector = Selector::parse("*").expect("static universal selector is valid");
    let mut landmark_counts = std::collections::BTreeMap::new();
    let mut aria_attribute_count = 0;
    let mut ids = HashSet::new();
    let mut nonempty_id_names = HashSet::new();
    let mut duplicate_id_values = HashSet::new();
    let mut duplicate_id_count = 0;
    let mut duplicate_ids = Vec::new();
    let mut unresolved_aria_reference_count = 0;
    let mut unresolved_aria_references = Vec::new();
    for element in document.select(&all_elements_selector) {
        if let Some(id) = element
            .value()
            .attr("id")
            .map(str::trim)
            .filter(|id| !id.is_empty())
        {
            if element
                .text()
                .any(|text| text.chars().any(|character| !character.is_whitespace()))
                || element
                    .value()
                    .attr("aria-label")
                    .is_some_and(|value| !value.trim().is_empty())
                || element
                    .value()
                    .attr("title")
                    .is_some_and(|value| !value.trim().is_empty())
            {
                nonempty_id_names.insert(id.to_string());
            }
            if !ids.insert(id.to_string()) {
                duplicate_id_count += 1;
                duplicate_id_values.insert(id.to_string());
                if duplicate_ids.len() < 10 && !duplicate_ids.iter().any(|existing| existing == id)
                {
                    duplicate_ids.push(id.to_string());
                }
            }
        }
    }
    for element in document.select(&all_elements_selector) {
        aria_attribute_count += element
            .value()
            .attrs()
            .filter(|(name, _)| name.to_ascii_lowercase().starts_with("aria-"))
            .count();
        for attribute in [
            "aria-labelledby",
            "aria-describedby",
            "aria-controls",
            "aria-owns",
            "aria-flowto",
            "aria-details",
            "aria-errormessage",
        ] {
            if let Some(value) = element.value().attr(attribute) {
                for reference in value.split_ascii_whitespace() {
                    if !reference.is_empty() && !ids.contains(reference) {
                        unresolved_aria_reference_count += 1;
                        if unresolved_aria_references.len() < 10 {
                            unresolved_aria_references.push((attribute, reference.to_string()));
                        }
                    }
                }
            }
        }
        let tag = element.value().name();
        let landmark = match tag {
            "main" => Some("main".to_string()),
            "nav" => Some("navigation".to_string()),
            "aside" => Some("complementary".to_string()),
            "footer" => Some("contentinfo".to_string()),
            "header" => Some("banner".to_string()),
            _ => match element
                .value()
                .attr("role")
                .map(|value| value.trim().to_ascii_lowercase())
            {
                Some(role)
                    if matches!(
                        role.as_str(),
                        "main"
                            | "navigation"
                            | "complementary"
                            | "contentinfo"
                            | "banner"
                            | "search"
                            | "region"
                    ) =>
                {
                    Some(role)
                }
                _ => None,
            },
        };
        if let Some(landmark) = landmark {
            *landmark_counts.entry(landmark).or_insert(0) += 1;
        }
    }
    IdentityInventory {
        landmark_counts,
        aria_attribute_count,
        ids,
        nonempty_id_names,
        duplicate_id_values,
        duplicate_id_count,
        duplicate_ids,
        unresolved_aria_reference_count,
        unresolved_aria_references,
    }
}
