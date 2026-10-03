use super::time::SchedulerTime;
use std::path::Path;

pub(super) fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub(super) fn launchd_plist(
    label: &str,
    executable: &Path,
    trigger: SchedulerTime,
    project_id: &str,
    schedule_id: &str,
    queue: bool,
) -> String {
    let executable = escape_xml(&executable.to_string_lossy());
    let project = escape_xml(project_id);
    let schedule = escape_xml(schedule_id);
    let launch_flag = if queue {
        "--seomi-audit-queue-headless"
    } else {
        "--seomi-scheduled-headless"
    };
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>{label}</string>
<key>ProgramArguments</key><array><string>{executable}</string><string>{launch_flag}</string><string>--seomi-scheduled-project</string><string>{project}</string><string>--seomi-scheduled-id</string><string>{schedule}</string></array>
<key>RunAtLoad</key><false/>
<key>StartCalendarInterval</key><dict>
<key>Year</key><integer>{year}</integer>
<key>Month</key><integer>{month}</integer>
<key>Day</key><integer>{day}</integer>
<key>Hour</key><integer>{hour}</integer>
<key>Minute</key><integer>{minute}</integer>
</dict>
<key>ProcessType</key><string>Background</string>
</dict></plist>
"#,
        year = trigger.year,
        month = trigger.month,
        day = trigger.day,
        hour = trigger.hour,
        minute = trigger.minute,
    )
}
