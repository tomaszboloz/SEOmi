use super::models::ScheduledExecutionHandoff;

impl ScheduledExecutionHandoff {
    pub(super) fn fingerprint_of(&self) -> String {
        use sha2::{Digest, Sha256};
        let identity = [
            self.project_id.as_str(),
            self.schedule_id.as_str(),
            self.task_type.as_str(),
            self.started_at.as_str(),
            self.completed_at.as_str(),
            if self.succeeded { "ok" } else { "failed" },
        ]
        .join("\n");
        Sha256::digest(identity.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }
}
