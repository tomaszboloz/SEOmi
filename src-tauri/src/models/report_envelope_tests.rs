use super::*;

const FIXTURE: &str = include_str!("../../../tests/fixtures/envelope/round_trip.json");

#[test]
fn fixture_round_trips_through_serde_without_loss() {
    let expected: serde_json::Value = serde_json::from_str(FIXTURE).unwrap();
    let parsed: Vec<ReportEnvelope> = serde_json::from_str(FIXTURE).unwrap();
    assert_eq!(parsed.len(), 2);
    assert!(parsed.iter().all(ReportEnvelope::is_consistent));
    assert_eq!(serde_json::to_value(&parsed).unwrap(), expected);
}

#[test]
fn measured_zero_survives_and_unavailable_stays_null() {
    let parsed: Vec<ReportEnvelope> = serde_json::from_str(FIXTURE).unwrap();
    assert_eq!(parsed[0].value.as_ref().unwrap()["score"], 0);
    assert!(parsed[1].value.is_none());
    assert_eq!(parsed[1].availability.coverage, Some(0.0));
}

#[test]
fn error_status_with_a_value_is_inconsistent() {
    let mut parsed: Vec<ReportEnvelope> = serde_json::from_str(FIXTURE).unwrap();
    let mut first = parsed.remove(0);
    first.availability.status = "error".into();
    assert!(!first.is_consistent());
    first.value = None;
    assert!(first.is_consistent());
}
