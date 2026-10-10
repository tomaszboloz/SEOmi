use super::*;

#[cfg(test)]
#[path = "session_browser_edge_tests.rs"]
mod session_browser_edge_tests;
#[cfg(test)]
#[path = "session_contract_tests.rs"]
mod session_contract_tests;
#[cfg(test)]
#[path = "session_edge_fixture.rs"]
mod session_edge_fixture;
#[cfg(test)]
#[path = "session_fixture.rs"]
mod session_fixture;
#[cfg(test)]
#[path = "session_persistence_contract_tests.rs"]
mod session_persistence_contract_tests;
#[cfg(test)]
#[path = "session_refresh_contract_tests.rs"]
mod session_refresh_contract_tests;
#[cfg(test)]
#[path = "session_token_contract_tests.rs"]
mod session_token_contract_tests;
#[cfg(test)]
#[path = "token_entry_tests.rs"]
mod token_entry_tests;
#[cfg(test)]
#[path = "token_failure_contract_tests.rs"]
mod token_failure_contract_tests;
#[cfg(test)]
#[path = "transport_regressions.rs"]
mod transport_regressions;
#[cfg(test)]
#[path = "validation_tests.rs"]
mod validation_tests;

#[cfg(test)]
#[path = "credentials_error_tests.rs"]
mod credentials_error_tests;
#[cfg(test)]
#[path = "pkce_and_disconnect_tests.rs"]
mod pkce_and_disconnect_tests;
#[cfg(test)]
#[path = "session_request_helpers.rs"]
mod session_request_helpers;
#[cfg(test)]
#[path = "session_secret_persistence_tests.rs"]
mod session_secret_persistence_tests;

pub(super) use session_edge_fixture::{dependencies, Server, Store};
