use super::*;

pub(super) fn inspect_microdata(
    document: &Html,
    schema_types: &mut Vec<String>,
    schema_references: &mut Vec<CrawledSchemaReference>,
    findings: &mut Vec<CrawledSchemaFinding>,
    truncated: &mut bool,
) {
    let microdata_selector = Selector::parse("[itemscope]").unwrap();
    let itemprop_selector = Selector::parse("[itemprop]").unwrap();
    let microdata_items = document.select(&microdata_selector).collect::<Vec<_>>();
    for (index, element) in microdata_items
        .iter()
        .take(MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .enumerate()
    {
        let itemprops = element
            .select(&itemprop_selector)
            .flat_map(|property| {
                property
                    .value()
                    .attr("itemprop")
                    .unwrap_or_default()
                    .split_ascii_whitespace()
                    .map(str::to_owned)
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        let itemtype = element.value().attr("itemtype").map(str::trim);
        if let Some(itemtype) = itemtype {
            schema_types.extend(itemtype.split_ascii_whitespace().map(str::to_owned));
        }
        if let Some(itemid) = element.value().attr("itemid") {
            push_schema_reference(schema_references, "Microdata", index + 1, "itemid", itemid);
        }
        if let Some(itemref) = element.value().attr("itemref") {
            for target in itemref.split_ascii_whitespace() {
                push_schema_reference(schema_references, "Microdata", index + 1, "itemref", target);
            }
        }
        let value = serde_json::json!({ "itemtype": itemtype, "itemprops": itemprops });
        append_schema_findings(
            schema_validator::validate_microdata(&value),
            "Microdata",
            index + 1,
            findings,
            truncated,
        );
    }
    if microdata_items.len() > MAX_SCHEMA_DECLARATIONS_PER_PAGE {
        *truncated = true;
    }
}

pub(super) fn inspect_rdfa(
    document: &Html,
    schema_types: &mut Vec<String>,
    schema_references: &mut Vec<CrawledSchemaReference>,
    findings: &mut Vec<CrawledSchemaFinding>,
    truncated: &mut bool,
) {
    let rdfa_selector = Selector::parse(
        "[typeof], [property], [vocab], [about], [resource], [property][href], [property][src], [rel][resource]",
    )
    .unwrap();
    let rdfa_nodes = document.select(&rdfa_selector).collect::<Vec<_>>();
    for (index, element) in rdfa_nodes
        .iter()
        .take(MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .enumerate()
    {
        let typeof_value = element.value().attr("typeof").map(str::trim);
        if let Some(typeof_value) = typeof_value {
            schema_types.extend(typeof_value.split_ascii_whitespace().map(str::to_owned));
        }
        let value = serde_json::json!({
            "typeof": typeof_value,
            "property": element.value().attr("property").map(str::trim),
            "vocab": element.value().attr("vocab").map(str::trim),
            "about": element.value().attr("about"),
            "resource": element.value().attr("resource"),
        });
        let relation_property = element
            .value()
            .attr("property")
            .or_else(|| element.value().attr("rel"))
            .unwrap_or("@resource");
        for attribute in ["resource", "href", "src", "about"] {
            if let Some(target) = element.value().attr(attribute) {
                push_schema_reference(
                    schema_references,
                    "RDFa",
                    index + 1,
                    relation_property,
                    target,
                );
            }
        }
        append_schema_findings(
            schema_validator::validate_rdfa(&value),
            "RDFa",
            index + 1,
            findings,
            truncated,
        );
    }
    if rdfa_nodes.len() > MAX_SCHEMA_DECLARATIONS_PER_PAGE {
        *truncated = true;
    }
}
