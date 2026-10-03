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
pub(super) fn ceil_to_minute(
    value: chrono::DateTime<chrono::Local>,
) -> chrono::DateTime<chrono::Local> {
    let minute = value
        .with_second(0)
        .and_then(|value| value.with_nanosecond(0))
        .expect("a valid local time can always be normalized to a minute");
    if value == minute {
        minute
    } else {
        minute + chrono::Duration::minutes(1)
    }
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
