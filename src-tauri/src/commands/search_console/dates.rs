use chrono::{Days, NaiveDate, Utc};

pub(super) fn date_range() -> (String, String) {
    let now = Utc::now().date_naive();
    let end = now.checked_sub_days(Days::new(3)).unwrap_or(now);
    let start = end.checked_sub_days(Days::new(27)).unwrap_or(end);
    (start.to_string(), end.to_string())
}

pub(super) fn requested_date_range(
    start_date: Option<&str>,
    end_date: Option<&str>,
) -> Result<(String, String), String> {
    match (start_date, end_date) {
        (None, None) => Ok(date_range()),
        (Some(start), Some(end)) => {
            let start = NaiveDate::parse_from_str(start, "%Y-%m-%d")
                .map_err(|_| "Start date must be a valid YYYY-MM-DD date.".to_string())?;
            let end = NaiveDate::parse_from_str(end, "%Y-%m-%d")
                .map_err(|_| "End date must be a valid YYYY-MM-DD date.".to_string())?;
            if start > end {
                return Err("Start date must not be later than end date.".into());
            }
            let now = Utc::now().date_naive();
            let latest = now.checked_sub_days(Days::new(3)).unwrap_or(now);
            if end > latest {
                return Err(format!("Search Console usually has complete data through {latest}; choose an earlier range."));
            }
            Ok((start.to_string(), end.to_string()))
        }
        _ => Err("Podaj obie daty zakresu Search Console.".into()),
    }
}
