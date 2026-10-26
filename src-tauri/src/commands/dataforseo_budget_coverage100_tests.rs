use super::{reserve, BudgetInput};
use serde_json::json;
use std::process::Command;

const SERP: &str = "/v3/serp/google/organic/live/regular";

fn budget(limit_usd: f64, spent_usd: f64) -> BudgetInput {
    BudgetInput {
        limit_usd,
        spent_usd,
        month: "coverage100-invalid-cost".into(),
    }
}

#[test]
fn settle_releases_pending_hold_when_provider_cost_is_missing_or_not_numeric() {
    let held = reserve("coverage100-invalid-cost", SERP, Some(&budget(0.15, 0.0))).unwrap();
    held.settle(Some(&json!({"cost": "not-a-number"})));
    let next = reserve("coverage100-invalid-cost", SERP, Some(&budget(0.15, 0.0)))
        .expect("pending hold must be released");
    next.settle(None);
}

#[test]
fn settle_with_no_ledger_is_a_safe_no_op() {
    let reservation = super::Reservation {
        key: Some(("coverage100-untracked".into(), SERP.into(), 0.1)),
    };
    reservation.settle(Some(&json!({"cost": 0.1})));
}

#[test]
fn poisoned_budget_mutex_is_reported_without_contaminating_parent() {
    const NAME: &str = "commands::dataforseo_budget::coverage100_tests::poisoned_budget_mutex_is_reported_without_contaminating_parent";
    const CHILD: &str = "SEOMI_COVERAGE100_BUDGET_POISON_CHILD";
    if std::env::var_os(CHILD).is_some() {
        let panic = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = super::LEDGERS.lock().unwrap();
            panic!("poison coverage mutex");
        }));
        assert!(panic.is_err());
        assert!(matches!(
            reserve("coverage100-poison", SERP, Some(&budget(1.0, 0.0))),
            Err(error) if error == "DataForSEO budget unavailable."
        ));
        super::Reservation {
            key: Some(("coverage100-poison".into(), SERP.into(), 0.1)),
        }
        .settle(None);
        return;
    }
    let output = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", NAME, "--nocapture"])
        .env(CHILD, "1")
        .output()
        .unwrap();
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.status.success(), "{text}");
    assert!(text.contains("running 1 test"), "{text}");
    assert_eq!(
        text.matches(&format!("test {NAME} ... ok")).count(),
        1,
        "{text}"
    );
}
