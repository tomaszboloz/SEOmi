use super::*;

pub(in crate::services::html_parser) fn extract_rdfa(document: &Html) -> Vec<StructuredData> {
    let mut list = Vec::new();
    // RDFa: preserve only values explicitly declared on the element. This is
    // extraction, not a claim that the vocabulary is semantically valid.
    let rdfa_selector = Selector::parse(
        "[typeof], [property], [vocab], [rel], [rev], [datatype], [content], [prefix]",
    )
    .unwrap();
    for el in document.select(&rdfa_selector) {
        let typeof_value = el
            .value()
            .attr("typeof")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let property = el
            .value()
            .attr("property")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let vocab = el
            .value()
            .attr("vocab")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let rel = el
            .value()
            .attr("rel")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let rev = el
            .value()
            .attr("rev")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let datatype = el
            .value()
            .attr("datatype")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let content_value = el
            .value()
            .attr("content")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let prefix = el
            .value()
            .attr("prefix")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        // `rel` and `content` are common non-RDFa HTML attributes (for
        // example on link/meta elements). Keep the broader selector so their
        // values can be preserved when a real RDFa anchor is present, but do
        // not turn ordinary HTML into structured-data records.
        if typeof_value.is_none() && property.is_none() && vocab.is_none() {
            continue;
        }
        let data_type = typeof_value
            .map(str::to_string)
            .or_else(|| property.map(|value| format!("property: {value}")))
            .or_else(|| vocab.map(|value| format!("vocab: {value}")))
            .expect("RDFa selector guarantees at least one usable attribute");
        let content = serde_json::json!({
            "typeof": typeof_value,
            "property": property,
            "vocab": vocab,
            "about": el.value().attr("about"),
            "resource": el.value().attr("resource"),
            "rel": rel,
            "rev": rev,
            "datatype": datatype,
            "content": content_value,
            "prefix": prefix,
            "inlist": el.value().attr("inlist").is_some(),
        });
        list.push(StructuredData {
            data_type,
            format: "RDFa".to_string(),
            validation_issues: schema_validator::validate_rdfa(&content),
            content,
        });
    }

    list
}
