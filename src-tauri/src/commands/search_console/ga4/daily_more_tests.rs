use super::tests::{body, client, row, run, SITE};
use super::*;

#[tokio::test]
async fn rejects_malformed_responses() {
    let no_currency = format!(r#"{{"rows":[{}]}}"#, row("20260101", "1", "1"));
    for (reply, text) in [
        (no_currency, "currency"),
        (body(&[row("20260101", "1", "1")], 1, "pln"), "currency"),
        (body(&[row("2026-01-01", "1", "1")], 1, "EUR"), "row"),
        (
            body(
                &[r#"{"dimensionValues":[],"metricValues":[]}"#.into()],
                1,
                "EUR",
            ),
            "row",
        ),
        (body(&[row("20260101", "-1", "1")], 1, "EUR"), "amount"),
        (body(&[row("20260101", "1", "x")], 1, "EUR"), "amount"),
        (r#"{"rows":"x"}"#.to_string(), "report"),
    ] {
        let (result, _) = run(&reply, None).await;
        assert!(result.unwrap_err().contains(text), "{text}");
    }
}

#[tokio::test]
async fn validates_inputs_before_calling_google() {
    let call = |token: &'static str,
                property: &'static str,
                host: &'static str,
                range: (&'static str, &'static str),
                page: Option<&'static str>| async move {
        daily_at(
            &client(),
            token,
            (property, SITE, host),
            (range.0, range.1, page.map(str::to_owned)),
            "http://127.0.0.1:1",
        )
        .await
        .unwrap_err()
    };
    let ok = ("2026-01-01", "2026-01-02");
    assert!(call("", "properties/9", "example.com", ok, None)
        .await
        .contains("token"));
    assert!(call("t", "bad", "example.com", ok, None)
        .await
        .contains("property"));
    assert!(call(
        "t",
        "properties/9",
        "example.com",
        ("2026-02-01", "2026-01-01"),
        None
    )
    .await
    .contains("date range"));
    assert!(
        call("t", "properties/9", "example.com", ok, Some("pricing"))
            .await
            .contains("page path")
    );
    assert!(call("t", "properties/9", "example.com", ok, Some("/a b"))
        .await
        .contains("page path"));
    assert!(call("t", "properties/9", "other.com", ok, None)
        .await
        .contains("outside"));
    assert!(call("t", "properties/9", "bad/host", ok, None)
        .await
        .contains("outside"));
}
