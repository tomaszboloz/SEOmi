use super::*;

#[test]
fn dispatch_preserves_outcome_and_correlates_json_without_input_payloads() {
    for accepted in [true, false] {
        let mut records = Vec::new();
        let mut calls = 0;
        let result = dispatch_with_sink(
            "get_secret",
            || {
                calls += 1;
                accepted
            },
            |entry| {
                records.push(serde_json::to_value(entry).unwrap());
                Ok(())
            },
        );
        assert_eq!(result, accepted);
        assert_eq!(calls, 1);
        assert_eq!(records.len(), 2);
        assert_eq!(records[0]["event"], "ipc_received");
        assert_eq!(records[1]["event"], "ipc_dispatched");
        assert_eq!(records[0]["request_id"], records[1]["request_id"]);
        assert!(Uuid::parse_str(records[0]["request_id"].as_str().unwrap()).is_ok());
        assert_eq!(records[1]["accepted"], accepted);
        assert_eq!(records[1]["level"], if accepted { "info" } else { "warn" });
        assert!(records[1]["dispatch_duration_ms"].is_number());
        assert!(records
            .iter()
            .all(|r| r.get("args").is_none() && r.get("error").is_none()));
    }
}
