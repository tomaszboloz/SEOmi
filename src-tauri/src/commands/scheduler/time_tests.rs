use super::*;
use chrono::TimeZone;

#[test]
fn scheduler_trigger_is_local_and_minute_aligned() {
    let now = chrono::Local::now();
    let target = now + chrono::Duration::days(3) + chrono::Duration::seconds(17);
    let value = target.to_rfc3339();
    let trigger = scheduler_time_at(&value, now).expect("valid schedule should parse");
    let expected = ceil_to_minute(target);
    assert_eq!(
        (
            trigger.year,
            trigger.month,
            trigger.day,
            trigger.hour,
            trigger.minute
        ),
        (
            expected.year(),
            expected.month(),
            expected.day(),
            expected.hour(),
            expected.minute()
        ),
    );
}

#[test]
fn overdue_trigger_is_moved_to_a_future_minute() {
    let now = chrono::Local::now();
    let value = (now - chrono::Duration::hours(1)).to_rfc3339();
    let trigger = scheduler_time_at(&value, now).expect("valid schedule should parse");
    let trigger_at = chrono::Local
        .with_ymd_and_hms(
            trigger.year,
            trigger.month,
            trigger.day,
            trigger.hour,
            trigger.minute,
            0,
        )
        .single()
        .expect("calendar components should be valid");
    assert!(trigger_at > now);
}

#[test]
fn scheduler_trigger_rejects_invalid_timestamp() {
    assert!(scheduler_time("not-a-date").is_err());
}
