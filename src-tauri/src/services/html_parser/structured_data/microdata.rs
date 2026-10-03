use super::*;

pub(in crate::services::html_parser) fn extract_microdata(document: &Html) -> Vec<StructuredData> {
    let mut list = Vec::new();
    // Microdata
    let microdata_selector = Selector::parse("[itemscope]").unwrap();
    for el in document.select(&microdata_selector) {
        let itemtype = el.value().attr("itemtype").map(str::trim);
        let itemprop_selector = Selector::parse("[itemprop]").unwrap();
        let itemprops = el
            .select(&itemprop_selector)
            .flat_map(|property| {
                property
                    .value()
                    .attr("itemprop")
                    .unwrap_or_default()
                    .split_ascii_whitespace()
            })
            .map(str::to_string)
            .collect::<Vec<_>>();
        let itemref = el
            .value()
            .attr("itemref")
            .unwrap_or_default()
            .split_ascii_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let content = serde_json::json!({
            "itemscope": true,
            "itemtype": itemtype,
            "itemid": el.value().attr("itemid"),
            "itemref": itemref,
            "itemprops": itemprops,
        });
        list.push(StructuredData {
            data_type: if itemtype.map_or(true, str::is_empty) {
                "Unknown Microdata item".into()
            } else {
                itemtype.unwrap().into()
            },
            format: "Microdata".to_string(),
            validation_issues: schema_validator::validate_microdata(&content),
            content,
        });
    }

    list
}
