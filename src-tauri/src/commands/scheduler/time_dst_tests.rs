use super::*;
use chrono::{FixedOffset, LocalResult, NaiveDate, NaiveDateTime, Offset, TimeZone, Utc};

/// A zone whose wall-clock times are always ambiguous, like the repeated hour when DST ends.
#[derive(Clone, Copy, Debug)]
struct RepeatedHour;

impl TimeZone for RepeatedHour {
    type Offset = FixedOffset;

    fn from_offset(_: &FixedOffset) -> Self {
        Self
    }

    fn offset_from_local_date(&self, _: &NaiveDate) -> LocalResult<FixedOffset> {
        LocalResult::None
    }

    fn offset_from_local_datetime(&self, _: &NaiveDateTime) -> LocalResult<FixedOffset> {
        LocalResult::Ambiguous(
            FixedOffset::east_opt(7200).unwrap(),
            FixedOffset::east_opt(3600).unwrap(),
        )
    }

    fn offset_from_utc_date(&self, _: &NaiveDate) -> FixedOffset {
        FixedOffset::east_opt(3600).unwrap()
    }

    fn offset_from_utc_datetime(&self, _: &NaiveDateTime) -> FixedOffset {
        FixedOffset::east_opt(3600).unwrap()
    }
}

#[test]
fn a_time_in_a_repeated_dst_hour_is_rounded_without_panicking() {
    let value = Utc
        .with_ymd_and_hms(2026, 10, 25, 1, 18, 30)
        .unwrap()
        .with_timezone(&RepeatedHour);
    assert!(
        value.with_second(0).is_none(),
        "the local wall clock is ambiguous"
    );
    let rounded = ceil_to_minute(value);
    assert_eq!(
        rounded.with_timezone(&Utc),
        Utc.with_ymd_and_hms(2026, 10, 25, 1, 19, 0).unwrap()
    );
    assert_eq!(rounded.offset().fix().local_minus_utc(), 3600);
}

#[test]
fn rounding_is_exact_idempotent_and_correct_for_half_hour_offsets() {
    for seconds in [0, 5400, -12600, 19800] {
        let zone = FixedOffset::east_opt(seconds).unwrap();
        let exact = zone.with_ymd_and_hms(2026, 3, 29, 2, 30, 0).unwrap();
        assert_eq!(ceil_to_minute(exact), exact);
        let late = exact + chrono::Duration::milliseconds(1);
        assert_eq!(ceil_to_minute(late), exact + chrono::Duration::minutes(1));
        assert_eq!(ceil_to_minute(ceil_to_minute(late)), ceil_to_minute(late));
        assert_eq!(ceil_to_minute(late).offset(), late.offset());
    }
}
