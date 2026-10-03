use super::models::CustomSearchDefinition;

pub fn query(selector_type: &str, query: &str, result_type: &str) -> CustomSearchDefinition {
    CustomSearchDefinition {
        id: "test".into(),
        name: "Test query".into(),
        selector_type: selector_type.into(),
        query: query.into(),
        result_type: result_type.into(),
        attribute: (result_type == "attribute").then(|| "href".into()),
    }
}
