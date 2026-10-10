use super::models::{ScheduledExecutionHandoff, ScheduledTaskExecution, ScheduledTaskManifest};
use serde_json::{json, Value};

fn manifest_payload() -> Value {
    json!({
        "scheduleId": "schedule-1", "url": "https://example.test",
        "taskType": "page-audit", "intervalHours": 24, "enabled": true,
        "status": "scheduled", "createdAt": "2026-09-25T00:00:00Z",
        "nextRunAt": "2026-09-25T01:00:00Z"
    })
}

#[test]
fn manifest_wire_defaults_camel_case_and_unknown_fields() {
    let mut value = manifest_payload();
    value["futureField"] = json!(true);
    let task: ScheduledTaskManifest = serde_json::from_value(value).unwrap();
    assert!(task.crawl_limit.is_none() && task.crawl_config.is_none());
    assert!(task.last_error.is_none() && task.run_history.is_empty());
    let wire = serde_json::to_value(task).unwrap();
    assert!(wire.get("scheduleId").is_some() && wire.get("schedule_id").is_none());
    assert!(wire.get("futureField").is_none());
}

#[test]
fn manifest_wire_rejects_missing_wrong_type_and_invalid_sequence() {
    let mut missing = manifest_payload();
    missing.as_object_mut().unwrap().remove("scheduleId");
    assert!(serde_json::from_value::<ScheduledTaskManifest>(missing).is_err());
    let mut wrong = manifest_payload();
    wrong["intervalHours"] = json!("daily");
    assert!(serde_json::from_value::<ScheduledTaskManifest>(wrong).is_err());
    assert!(serde_json::from_value::<ScheduledTaskManifest>(json!(["schedule-1"])).is_err());
    let error = serde_json::from_str::<ScheduledTaskManifest>(
        r#"{"scheduleId":"first","scheduleId":"last","url":"https://example.test","taskType":"page-audit","intervalHours":24,"enabled":true,"status":"scheduled","createdAt":"2026-09-25T00:00:00Z","nextRunAt":"2026-09-25T01:00:00Z"}"#,
    )
    .unwrap_err();
    assert!(error.to_string().contains("duplicate field"));
    assert!(error.to_string().contains("scheduleId"));
}

#[test]
fn execution_wire_defaults_error_and_accepts_a_valid_sequence() {
    let execution: ScheduledTaskExecution = serde_json::from_value(json!([
        "2026-09-25T00:00:00Z",
        "2026-09-25T01:00:00Z",
        true,
        null
    ]))
    .unwrap();
    assert!(execution.error.is_none());
    let object: ScheduledTaskExecution = serde_json::from_value(json!({
        "startedAt": "2026-09-25T00:00:00Z",
        "completedAt": "2026-09-25T01:00:00Z", "succeeded": false
    }))
    .unwrap();
    assert!(object.error.is_none());
    assert!(
        serde_json::from_value::<ScheduledTaskExecution>(json!(["2026-09-25T00:00:00Z"])).is_err()
    );
    assert!(serde_json::from_value::<ScheduledTaskExecution>(json!({
        "startedAt": 1, "completedAt": "done", "succeeded": true
    }))
    .is_err());
    let error = serde_json::from_str::<ScheduledTaskExecution>(
        r#"{"startedAt":"first","startedAt":"last","completedAt":"done","succeeded":true}"#,
    )
    .unwrap_err();
    assert!(error.to_string().contains("duplicate field"));
    assert!(error.to_string().contains("startedAt"));
}

#[test]
fn handoff_wire_defaults_optional_result_and_preserves_json_value() {
    let handoff: ScheduledExecutionHandoff = serde_json::from_value(json!({
        "projectId": "project-1", "scheduleId": "schedule-1",
        "taskType": "page-audit", "startedAt": "2026-09-25T00:00:00Z",
        "completedAt": "2026-09-25T01:00:00Z", "succeeded": true,
        "nextRunAt": "2026-09-25T02:00:00Z", "unknown": "ignored"
    }))
    .unwrap();
    assert!(handoff.error.is_none() && handoff.scheduler_error.is_none());
    assert!(handoff.result.is_none());
    let with_result: ScheduledExecutionHandoff = serde_json::from_value(json!({
        "projectId": "project-1", "scheduleId": "schedule-1",
        "taskType": "page-audit", "startedAt": "2026-09-25T00:00:00Z",
        "completedAt": "2026-09-25T01:00:00Z", "succeeded": true,
        "nextRunAt": "2026-09-25T02:00:00Z", "result": {"pages": 1}
    }))
    .unwrap();
    assert_eq!(with_result.result.unwrap()["pages"], 1);
}

#[test]
fn handoff_wire_rejects_required_field_errors_and_accepts_sequence_order() {
    let mut missing = json!({
        "scheduleId": "schedule-1", "taskType": "page-audit",
        "startedAt": "2026-09-25T00:00:00Z", "completedAt": "2026-09-25T01:00:00Z",
        "succeeded": true, "nextRunAt": "2026-09-25T02:00:00Z"
    });
    assert!(serde_json::from_value::<ScheduledExecutionHandoff>(missing.take()).is_err());
    let sequence: ScheduledExecutionHandoff = serde_json::from_value(json!([
        "project-1", "schedule-1", "page-audit", "2026-09-25T00:00:00Z",
        "2026-09-25T01:00:00Z", true, "2026-09-25T02:00:00Z", null, null, {"ok": true}
    ]))
    .unwrap();
    assert_eq!(sequence.project_id, "project-1");
    assert!(serde_json::from_value::<ScheduledExecutionHandoff>(json!(["project-1"])).is_err());
    assert!(serde_json::from_value::<ScheduledExecutionHandoff>(json!({
        "projectId": [], "scheduleId": "schedule-1", "taskType": "page-audit",
        "startedAt": "2026-09-25T00:00:00Z", "completedAt": "2026-09-25T01:00:00Z",
        "succeeded": true, "nextRunAt": "2026-09-25T02:00:00Z"
    }))
    .is_err());
    let error = serde_json::from_str::<ScheduledExecutionHandoff>(
        r#"{"projectId":"first","projectId":"last","scheduleId":"schedule-1","taskType":"page-audit","startedAt":"2026-09-25T00:00:00Z","completedAt":"2026-09-25T01:00:00Z","succeeded":true,"nextRunAt":"2026-09-25T02:00:00Z"}"#,
    )
    .unwrap_err();
    assert!(error.to_string().contains("duplicate field"));
    assert!(error.to_string().contains("projectId"));
}
