use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;

/// Conservative price (USD) assumed for an endpoint with no observed cost.
pub(crate) const UNSEEN_ENDPOINT_ESTIMATE_USD: f64 = 0.1;
const ACCOUNT_PATH: &str = "/v3/appendix/user_data";

/// Monthly cap sent by the WebView with each request; absent = no cap.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BudgetInput {
    pub limit_usd: f64,
    pub spent_usd: f64,
    pub month: String,
}

#[derive(Default)]
struct ProjectLedger {
    month: String,
    spent: f64,
    pending: f64,
    last_cost: HashMap<String, f64>,
}

static LEDGERS: Mutex<Option<HashMap<String, ProjectLedger>>> = Mutex::new(None);

/// Held while a request is in flight; `settle` books the real cost.
pub(crate) struct Reservation {
    key: Option<(String, String, f64)>,
}

fn finite(value: f64) -> bool {
    value.is_finite() && value >= 0.0
}

/// Rejects a paid call before any network traffic when spent + in-flight +
/// estimate would exceed the cap. Native spend is tracked per month, so a
/// WebView that under-reports `spentUsd` cannot hide spend seen here.
pub(crate) fn reserve(
    project_id: &str,
    path: &str,
    budget: Option<&BudgetInput>,
) -> Result<Reservation, String> {
    let Some(budget) = budget.filter(|_| path != ACCOUNT_PATH) else {
        return Ok(Reservation { key: None });
    };
    if !finite(budget.limit_usd) || !finite(budget.spent_usd) {
        return Err("Invalid DataForSEO budget.".into());
    }
    let mut guard = LEDGERS
        .lock()
        .map_err(|_| "DataForSEO budget unavailable.".to_string())?;
    let ledger = guard
        .get_or_insert_with(HashMap::new)
        .entry(project_id.into())
        .or_default();
    if ledger.month != budget.month {
        *ledger = ProjectLedger {
            month: budget.month.clone(),
            ..Default::default()
        };
    }
    let estimate = ledger
        .last_cost
        .get(path)
        .copied()
        .unwrap_or(UNSEEN_ENDPOINT_ESTIMATE_USD);
    let spent = ledger.spent.max(budget.spent_usd);
    if spent + ledger.pending + estimate > budget.limit_usd + 1e-9 {
        return Err(format!(
            "DataForSEO monthly limit would be exceeded (spent ${spent:.4} of ${:.2}, next call ~${estimate:.4}).",
            budget.limit_usd
        ));
    }
    ledger.pending += estimate;
    Ok(Reservation {
        key: Some((project_id.into(), path.into(), estimate)),
    })
}

impl Reservation {
    /// Releases the hold and books `response.cost` when present.
    pub(crate) fn settle(self, response: Option<&Value>) {
        let Some((project, path, estimate)) = self.key else {
            return;
        };
        let Ok(mut guard) = LEDGERS.lock() else {
            return;
        };
        let Some(ledger) = guard.as_mut().and_then(|all| all.get_mut(&project)) else {
            return;
        };
        ledger.pending = (ledger.pending - estimate).max(0.0);
        let cost = response
            .and_then(|body| body.get("cost"))
            .and_then(Value::as_f64);
        if let Some(cost) = cost.filter(|cost| finite(*cost)) {
            ledger.spent += cost;
            ledger.last_cost.insert(path, cost);
        }
    }
}

#[cfg(test)]
#[path = "dataforseo_budget_tests.rs"]
mod tests;
