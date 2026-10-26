//! Explicit test fixture origin registration for test harnesses and examples.
//! In production release builds, all test fixture seams compile down to false.

use std::net::SocketAddr;

#[cfg(any(test, feature = "test-fixture"))]
use std::sync::RwLock;

#[cfg(any(test, feature = "test-fixture"))]
static ALLOWED_FIXTURE_SOCKET: RwLock<Option<SocketAddr>> = RwLock::new(None);

#[cfg(any(test, feature = "test-fixture"))]
pub fn register_test_fixture_socket(addr: SocketAddr) {
    if let Ok(mut lock) = ALLOWED_FIXTURE_SOCKET.write() {
        *lock = Some(addr);
    }
}

#[cfg(any(test, feature = "test-fixture"))]
pub fn clear_test_fixture_socket() {
    if let Ok(mut lock) = ALLOWED_FIXTURE_SOCKET.write() {
        *lock = None;
    }
}

#[cfg(any(test, feature = "test-fixture"))]
pub fn is_allowed_test_fixture_socket(addr: &SocketAddr) -> bool {
    if let Ok(lock) = ALLOWED_FIXTURE_SOCKET.read() {
        if let Some(fixture) = *lock {
            return addr == &fixture;
        }
    }
    false
}

#[cfg(any(test, feature = "test-fixture"))]
pub fn is_allowed_fixture_port(port: u16) -> bool {
    if let Ok(lock) = ALLOWED_FIXTURE_SOCKET.read() {
        if let Some(fixture) = *lock {
            return port == fixture.port();
        }
    }
    false
}

#[cfg(not(any(test, feature = "test-fixture")))]
#[inline(always)]
pub fn is_allowed_test_fixture_socket(_addr: &SocketAddr) -> bool {
    false
}

#[cfg(not(any(test, feature = "test-fixture")))]
#[inline(always)]
pub fn is_allowed_fixture_port(_port: u16) -> bool {
    false
}

#[cfg(any(test, feature = "test-fixture"))]
pub struct FixtureGuard(SocketAddr);

#[cfg(any(test, feature = "test-fixture"))]
impl FixtureGuard {
    pub fn new(addr: SocketAddr) -> Self {
        register_test_fixture_socket(addr);
        Self(addr)
    }

    pub fn socket(&self) -> SocketAddr {
        self.0
    }
}

#[cfg(any(test, feature = "test-fixture"))]
impl Drop for FixtureGuard {
    fn drop(&mut self) {
        clear_test_fixture_socket();
    }
}

#[cfg(test)]
#[path = "test_fixture_tests.rs"]
mod tests;
