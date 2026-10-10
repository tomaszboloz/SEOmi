use crate::utils::url_validator::validate_and_normalize_url;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tokio::sync::Semaphore;

pub const MAX_CONCURRENT_PER_HOST: usize = 2;
pub type HostGates = Arc<Mutex<HashMap<String, Arc<Semaphore>>>>;

pub fn new_host_gates() -> HostGates {
    Arc::new(Mutex::new(HashMap::new()))
}

pub fn host_key(input: &str) -> String {
    validate_and_normalize_url(input)
        .ok()
        .and_then(|url| url.host_str().map(str::to_ascii_lowercase))
        .unwrap_or_else(|| input.trim().to_ascii_lowercase())
}

pub fn gate_for(input: &str, gates: &HostGates) -> Arc<Semaphore> {
    let key = host_key(input);
    let mut all = gates.lock().expect("external link gate mutex poisoned");
    Arc::clone(
        all.entry(key)
            .or_insert_with(|| Arc::new(Semaphore::new(MAX_CONCURRENT_PER_HOST))),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn same_host_gate_allows_two_requests_and_blocks_the_third() {
        let gates = Arc::new(Mutex::new(HashMap::new()));
        let gate = gate_for("https://Example.test/one", &gates);
        let first = gate.clone().acquire_owned().await.unwrap();
        let second = gate.clone().acquire_owned().await.unwrap();
        assert!(
            tokio::time::timeout(Duration::from_millis(10), gate.acquire_owned())
                .await
                .is_err()
        );
        drop(first);
        drop(second);
    }

    #[test]
    fn gate_keys_are_case_insensitive_and_separate_between_hosts() {
        let gates = Arc::new(Mutex::new(HashMap::new()));
        assert!(Arc::ptr_eq(
            &gate_for("https://Example.test/a", &gates),
            &gate_for("https://example.test/b", &gates)
        ));
        assert!(!Arc::ptr_eq(
            &gate_for("https://other.test/a", &gates),
            &gate_for("https://example.test/b", &gates)
        ));
    }
}
