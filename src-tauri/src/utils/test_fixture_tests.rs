use super::*;
use std::net::{IpAddr, Ipv4Addr};
use std::sync::Mutex;

static TEST_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn fixture_socket_defaults_to_disallowed() {
    let _lock = TEST_LOCK.lock().unwrap();
    clear_test_fixture_socket();
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 9999);
    assert!(!is_allowed_test_fixture_socket(&addr));
    assert!(!is_allowed_fixture_port(9999));
}

#[test]
fn registered_socket_is_strictly_matched_by_ip_and_port() {
    let _lock = TEST_LOCK.lock().unwrap();
    clear_test_fixture_socket();
    let target = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 8888);
    register_test_fixture_socket(target);
    assert!(is_allowed_test_fixture_socket(&target));
    assert!(is_allowed_fixture_port(8888));

    let wrong_port = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 8889);
    assert!(!is_allowed_test_fixture_socket(&wrong_port));
    assert!(!is_allowed_fixture_port(8889));

    let wrong_ip = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1)), 8888);
    assert!(!is_allowed_test_fixture_socket(&wrong_ip));

    clear_test_fixture_socket();
    assert!(!is_allowed_test_fixture_socket(&target));
}

#[test]
fn fixture_guard_clears_registration_on_drop() {
    let _lock = TEST_LOCK.lock().unwrap();
    clear_test_fixture_socket();
    let target = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 7777);
    {
        let guard = FixtureGuard::new(target);
        assert_eq!(guard.socket(), target);
        assert!(is_allowed_test_fixture_socket(&target));
        assert!(is_allowed_fixture_port(7777));
    }
    assert!(!is_allowed_test_fixture_socket(&target));
    assert!(!is_allowed_fixture_port(7777));
}

#[test]
fn url_validator_fixture_admission_and_strict_rejection() {
    let _lock = TEST_LOCK.lock().unwrap();
    clear_test_fixture_socket();
    let port = 65432;
    let url_fixture = format!("http://127.0.0.1:{port}/");
    let url_other_port = "http://127.0.0.1:8080/";
    let url_localhost = format!("http://localhost:{port}/");

    assert_eq!(
        crate::utils::url_validator::validate_and_normalize_url(&url_fixture),
        Err(crate::utils::url_validator::UrlValidationError::BlockedPrivateIp)
    );

    let target = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
    register_test_fixture_socket(target);
    assert!(crate::utils::url_validator::validate_and_normalize_url(&url_fixture).is_ok());

    assert_eq!(
        crate::utils::url_validator::validate_and_normalize_url(url_other_port),
        Err(crate::utils::url_validator::UrlValidationError::BlockedPrivateIp)
    );
    let url_foreign_ip = format!("http://192.168.1.1:{port}/");
    assert_eq!(
        crate::utils::url_validator::validate_and_normalize_url(&url_foreign_ip),
        Err(crate::utils::url_validator::UrlValidationError::BlockedPrivateIp)
    );
    assert_eq!(
        crate::utils::url_validator::validate_and_normalize_url(&url_localhost),
        Err(crate::utils::url_validator::UrlValidationError::BlockedLocalhost)
    );

    clear_test_fixture_socket();
    assert_eq!(
        crate::utils::url_validator::validate_and_normalize_url(&url_fixture),
        Err(crate::utils::url_validator::UrlValidationError::BlockedPrivateIp)
    );
}
