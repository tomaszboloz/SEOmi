use super::*;

pub(super) fn validate(
    value: &serde_json::Map<String, Value>,
    path: &str,
    issues: &mut IssueCollector,
) {
    validate_string_or_number_if_present(value, path, "price", "offer-price-shape-invalid", issues);
    validate_non_empty_string_if_present(
        value,
        path,
        "priceCurrency",
        "offer-currency-empty-or-invalid",
        issues,
    );
    validate_non_empty_string_if_present(
        value,
        path,
        "availability",
        "offer-availability-empty-or-invalid",
        issues,
    );
    validate_non_empty_string_if_present(value, path, "url", "offer-url-empty-or-invalid", issues);
}
