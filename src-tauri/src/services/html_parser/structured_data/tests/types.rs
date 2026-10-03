use super::*;

#[test]
fn type_summary_handles_graph_arrays_duplicates_and_unsupported_shapes() {
    let value = serde_json::json!([{"@type":["Article","Thing",4],"@graph":[{"@type":"Article"},{"@type":"Organization"}]},null,{"@type":42}]);
    assert_eq!(json_ld_type_summary(&value), "Article, Organization, Thing");
    for value in [
        serde_json::json!({}),
        serde_json::json!({"@type":false}),
        serde_json::json!(null),
        serde_json::json!({"@type":[]}),
    ] {
        assert_eq!(json_ld_type_summary(&value), "Unknown Schema");
    }
}
