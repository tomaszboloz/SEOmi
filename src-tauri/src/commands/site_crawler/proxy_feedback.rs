use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;

use super::proxy_pool::ProxyPool;

const MAX_PENDING: usize = 4_096;

pub(crate) type SharedPool = Arc<Mutex<ProxyPool>>;

type Pending = HashMap<String, (SharedPool, usize)>;

fn pending() -> &'static Mutex<Pending> {
    static PENDING: OnceLock<Mutex<Pending>> = OnceLock::new();
    PENDING.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Remembers which proxy carries the request for `target`, so its outcome can be attributed.
pub(crate) fn register(target: &str, pool: &SharedPool, index: usize) {
    if let Ok(mut map) = pending().lock() {
        if map.len() >= MAX_PENDING {
            map.clear();
        }
        map.insert(target.to_owned(), (Arc::clone(pool), index));
    }
}

/// Records the outcome of the request for `target`: transport failures, timeouts and HTTP 407 count
/// against the proxy that carried it; any other response clears its failure streak.
pub(crate) fn report(target: &str, outcome: &Result<u16, &reqwest::Error>) {
    let key = reqwest::Url::parse(target).map_or_else(|_| target.to_owned(), String::from);
    let entry = pending().lock().ok().and_then(|mut map| map.remove(&key));
    let Some((pool, index)) = entry else { return };
    let Ok(mut pool) = pool.lock() else { return };
    let failed = match outcome {
        Ok(status) => *status == 407,
        Err(error) => error.is_connect() || error.is_timeout(),
    };
    if failed {
        pool.record_failure(index, Instant::now());
    } else {
        pool.record_success(index);
    }
}

#[cfg(test)]
#[path = "proxy_feedback_tests.rs"]
mod tests;
