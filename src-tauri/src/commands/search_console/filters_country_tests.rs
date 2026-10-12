use super::filters::normalize_filters;
use super::models::GscPerformanceFilters;

fn country(value: &str) -> Result<String, String> {
    normalize_filters(Some(GscPerformanceFilters {
        country: Some(value.into()),
        ..Default::default()
    }))
    .map(|filters| filters.country.unwrap())
}

#[test]
fn country_must_be_exactly_three_ascii_letters() {
    assert_eq!(country(" USA "), Ok("usa".to_string()));
    assert!(country("u1a").is_err());
    assert!(country("us").is_err());
    assert!(country("usaa").is_err());
}
