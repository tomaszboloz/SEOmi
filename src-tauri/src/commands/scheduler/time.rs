use chrono::{Datelike, Timelike};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct SchedulerTime {
    pub(super) year: i32,
    pub(super) month: u32,
    pub(super) day: u32,
    pub(super) hour: u32,
    pub(super) minute: u32,
}

/// Convert the persisted UTC/RFC3339 deadline to a local, minute-granularity
/// trigger understood by launchd and Task Scheduler. Both OS schedulers may
/// start a process a few seconds early when seconds cannot be represented, so
/// round forward and let the app's due-time check provide the final guard.
pub(super) fn ceil_to_minute<Tz: chrono::TimeZone>(
    value: chrono::DateTime<Tz>,
) -> chrono::DateTime<Tz> {
    // Truncate in UTC: a local wall-clock time inside a repeated DST hour has two valid instants, so
    // `with_second` on the local value would return `None`. UTC minutes align with local minutes
    // because every time-zone offset is a whole number of minutes.
    let timezone = value.timezone();
    let utc = value.with_timezone(&chrono::Utc);
    let minute = utc
        .with_second(0)
        .and_then(|value| value.with_nanosecond(0))
        .expect("UTC can always be normalized to a minute");
    let rounded = if utc == minute {
        minute
    } else {
        minute + chrono::Duration::minutes(1)
    };
    rounded.with_timezone(&timezone)
}

pub(super) fn scheduler_time_at(
    next_run_at: &str,
    now: chrono::DateTime<chrono::Local>,
) -> Result<SchedulerTime, String> {
    let parsed = chrono::DateTime::parse_from_rfc3339(next_run_at)
        .map_err(|_| "Schedule next run must be an RFC3339 timestamp.".to_string())?;
    let local = parsed.with_timezone(&chrono::Local);
    let rounded = ceil_to_minute(local);
    let rounded = if rounded <= now {
        ceil_to_minute(now + chrono::Duration::seconds(1))
    } else {
        rounded
    };
    Ok(SchedulerTime {
        year: rounded.year(),
        month: rounded.month(),
        day: rounded.day(),
        hour: rounded.hour(),
        minute: rounded.minute(),
    })
}

pub(super) fn scheduler_time(next_run_at: &str) -> Result<SchedulerTime, String> {
    scheduler_time_at(next_run_at, chrono::Local::now())
}
