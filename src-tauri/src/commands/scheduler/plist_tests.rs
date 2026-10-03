use super::{plist::launchd_plist, time::SchedulerTime};
use std::path::Path;

fn trigger() -> SchedulerTime {
    SchedulerTime {
        year: 2026,
        month: 12,
        day: 31,
        hour: 23,
        minute: 59,
    }
}

#[test]
fn recurring_plist_preserves_safe_argument_boundaries_and_calendar_components() {
    let xml = launchd_plist(
        "seomi-audit-p-s",
        Path::new("/tmp/SEOmi & <test>\"'.app"),
        trigger(),
        "project&<>'\"",
        "schedule&<>'\"",
        false,
    );
    assert!(xml.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
    assert!(xml.ends_with("</dict></plist>\n"));
    assert!(xml.contains("<string>/tmp/SEOmi &amp; &lt;test&gt;&quot;&apos;.app</string>"));
    assert!(xml.contains("<string>project&amp;&lt;&gt;&apos;&quot;</string>"));
    assert!(xml.contains("<string>schedule&amp;&lt;&gt;&apos;&quot;</string>"));
    assert!(xml.contains("<string>--seomi-scheduled-headless</string>"));
    assert!(!xml.contains("--seomi-audit-queue-headless"));
    assert!(xml.contains("<key>RunAtLoad</key><false/>"));
    for (key, value) in [
        ("Year", 2026),
        ("Month", 12),
        ("Day", 31),
        ("Hour", 23),
        ("Minute", 59),
    ] {
        assert!(xml.contains(&format!("<key>{key}</key><integer>{value}</integer>")));
    }
}

#[test]
fn queue_plist_retains_distinct_label_and_queue_launch_flag() {
    let xml = launchd_plist(
        "seomi-audit-queue-p-r",
        Path::new("/tmp/SEOmi"),
        trigger(),
        "p",
        "r",
        true,
    );
    assert!(xml.contains("<key>Label</key><string>seomi-audit-queue-p-r</string>"));
    assert!(xml.contains("<string>--seomi-audit-queue-headless</string>"));
    assert!(!xml.contains("<string>--seomi-scheduled-headless</string>"));
    assert!(xml.contains("<string>--seomi-scheduled-project</string><string>p</string>"));
    assert!(xml.contains("<string>--seomi-scheduled-id</string><string>r</string>"));
}
