use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulerRegistration {
    pub platform: String,
    pub task_name: String,
    pub next_run_at: String,
    pub interval_hours: u32,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledLaunchContext {
    pub project_id: Option<String>,
    pub schedule_id: Option<String>,
    pub headless: bool,
}
