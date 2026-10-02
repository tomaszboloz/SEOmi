use super::models::GscPerformanceFilters;

const GSC_SEARCH_TYPES: [&str; 6] = ["web", "image", "video", "news", "discover", "googleNews"];
const GSC_DEVICES: [&str; 3] = ["DESKTOP", "MOBILE", "TABLET"];

pub(super) fn normalize_filters(
    filters: Option<GscPerformanceFilters>,
) -> Result<GscPerformanceFilters, String> {
    let mut filters = filters.unwrap_or_default();
    if let Some(search_type) = filters.search_type.as_mut() {
        *search_type = search_type.trim().to_string();
        if !GSC_SEARCH_TYPES.contains(&search_type.as_str()) {
            return Err("Invalid Search Console search type.".into());
        }
    }
    if let Some(device) = filters.device.as_mut() {
        *device = device.trim().to_ascii_uppercase();
        if !GSC_DEVICES.contains(&device.as_str()) {
            return Err("Search Console device must be DESKTOP, MOBILE or TABLET.".into());
        }
    }
    if let Some(country) = filters.country.as_mut() {
        *country = country.trim().to_ascii_lowercase();
        if country.len() != 3 || !country.bytes().all(|byte| byte.is_ascii_alphabetic()) {
            return Err(
                "Search Console country must be an ISO 3166-1 alpha-3 code, for example usa or gbr.".into(),
            );
        }
    }
    Ok(filters)
}
