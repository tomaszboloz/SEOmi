use super::super::into_json;
use serde::{ser::Error, Serialize, Serializer};
use serde_json::json;

struct Unserializable;

impl Serialize for Unserializable {
    fn serialize<S: Serializer>(&self, _: S) -> Result<S::Ok, S::Error> {
        Err(S::Error::custom("fixture"))
    }
}

#[test]
fn results_are_serialized_forwarded_or_reported_with_their_label() {
    assert_eq!(
        into_json(Ok(json!({"a": 1})), "page audit").unwrap()["a"],
        1
    );
    assert_eq!(
        into_json::<()>(Err("boom".into()), "page audit").unwrap_err(),
        "boom"
    );
    assert_eq!(
        into_json(Ok(Unserializable), "site crawl").unwrap_err(),
        "Unable to serialize site crawl: fixture"
    );
}

#[test]
fn manifest_serialization_failures_surface_the_serde_message() {
    use super::super::runner::value_of;
    assert_eq!(value_of(&json!([1])).unwrap(), json!([1]));
    assert_eq!(value_of(&Unserializable).unwrap_err(), "fixture");
}
