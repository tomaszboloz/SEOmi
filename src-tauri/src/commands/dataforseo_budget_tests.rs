use super::*;
use serde_json::json;

const SERP: &str = "/v3/serp/google/organic/live/regular";

fn cap(limit: f64, spent: f64, month: &str) -> BudgetInput {
    BudgetInput {
        limit_usd: limit,
        spent_usd: spent,
        month: month.into(),
    }
}

#[test]
fn no_budget_or_account_endpoint_is_never_blocked() {
    assert!(reserve("t-none", SERP, None).is_ok());
    assert!(reserve("t-acct", ACCOUNT_PATH, Some(&cap(0.0, 5.0, "m"))).is_ok());
}

#[test]
fn unseen_endpoint_uses_conservative_estimate() {
    let err = reserve("t-unseen", SERP, Some(&cap(0.05, 0.0, "m")))
        .err()
        .unwrap();
    assert!(err.contains("monthly limit would be exceeded"));
    assert!(reserve("t-unseen2", SERP, Some(&cap(0.5, 0.0, "m"))).is_ok());
}

#[test]
fn spend_reported_by_webview_counts_toward_the_cap() {
    let err = reserve("t-spent", SERP, Some(&cap(1.0, 0.95, "m")))
        .err()
        .unwrap();
    assert!(err.contains("$0.9500 of $1.00"), "{err}");
}

#[test]
fn settled_cost_is_remembered_even_if_webview_underreports() {
    let held = reserve("t-ledger", SERP, Some(&cap(1.0, 0.0, "m"))).unwrap();
    held.settle(Some(&json!({ "cost": 0.6 })));
    let err = reserve("t-ledger", SERP, Some(&cap(1.0, 0.0, "m")))
        .err()
        .unwrap();
    assert!(
        err.contains("spent $0.6000") && err.contains("~$0.6000"),
        "{err}"
    );
    assert!(reserve("t-ledger", SERP, Some(&cap(1.0, 0.0, "next"))).is_ok());
}

#[test]
fn in_flight_reservations_count_and_release_on_settle() {
    let first = reserve("t-flight", SERP, Some(&cap(0.15, 0.0, "m"))).unwrap();
    assert!(reserve("t-flight", SERP, Some(&cap(0.15, 0.0, "m"))).is_err());
    first.settle(None);
    assert!(reserve("t-flight", SERP, Some(&cap(0.15, 0.0, "m"))).is_ok());
}

#[test]
fn rejects_invalid_budget() {
    assert!(reserve("t-nan", SERP, Some(&cap(f64::NAN, 0.0, "m"))).is_err());
    assert!(reserve("t-neg", SERP, Some(&cap(1.0, -1.0, "m"))).is_err());
}
