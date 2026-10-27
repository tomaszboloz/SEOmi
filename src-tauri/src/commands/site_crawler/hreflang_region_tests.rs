use super::hreflang_validation::is_valid_hreflang_code;

#[test]
fn numeric_regions_need_exactly_three_digits() {
    assert!(is_valid_hreflang_code("es-419"));
    assert!(is_valid_hreflang_code("en-US"));
    assert!(!is_valid_hreflang_code("es-41"));
    assert!(!is_valid_hreflang_code("es-4a9"));
    assert!(!is_valid_hreflang_code("en-U1"));
}
