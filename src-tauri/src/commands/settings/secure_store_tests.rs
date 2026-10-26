use super::secure_store::{CredentialEntry, KeyringStore, SecureStore, NATIVE_STORE};
use keyring::Error;
use std::cell::RefCell;

struct MockCredential {
    password: RefCell<Option<String>>,
    error: RefCell<Option<Error>>,
}

impl MockCredential {
    fn new(password: Option<&str>, error: Option<Error>) -> Self {
        Self {
            password: RefCell::new(password.map(str::to_owned)),
            error: RefCell::new(error),
        }
    }
}

impl CredentialEntry for MockCredential {
    fn get_password(&self) -> Result<String, Error> {
        if let Some(error) = self.error.borrow_mut().take() {
            return Err(error);
        }
        self.password.borrow().clone().ok_or(Error::NoEntry)
    }

    fn set_password(&self, password: &str) -> Result<(), Error> {
        if let Some(error) = self.error.borrow_mut().take() {
            return Err(error);
        }
        *self.password.borrow_mut() = Some(password.to_owned());
        Ok(())
    }

    fn delete_credential(&self) -> Result<(), Error> {
        if let Some(error) = self.error.borrow_mut().take() {
            return Err(error);
        }
        if self.password.borrow_mut().take().is_some() {
            Ok(())
        } else {
            Err(Error::NoEntry)
        }
    }
}

fn entry(password: Option<&str>, error: Option<Error>) -> MockCredential {
    MockCredential::new(password, error)
}

#[test]
fn adapter_reads_real_entry_contract_and_distinguishes_missing_from_failure() {
    let seeded = KeyringStore {
        factory: |name: &str| {
            assert_eq!(name, "openai_api_key");
            Ok(entry(Some("synthetic-token żółć"), None))
        },
    };
    assert_eq!(
        seeded.read("openai_api_key").unwrap().as_deref(),
        Some("synthetic-token żółć")
    );
    let missing = KeyringStore {
        factory: |_: &str| Ok(entry(None, None)),
    };
    assert_eq!(missing.read("openai_api_key").unwrap(), None);
    let failed = KeyringStore {
        factory: |_: &str| {
            Ok(entry(
                None,
                Some(Error::Invalid("synthetic-private".into(), "details".into())),
            ))
        },
    };
    assert!(failed.read("openai_api_key").is_err());
}

#[test]
fn adapter_write_and_delete_map_backend_failures_without_raw_messages() {
    let writable = KeyringStore {
        factory: |_: &str| Ok(entry(Some("original"), None)),
    };
    assert!(writable.write("openai_api_key", "synthetic-token").is_ok());
    assert!(writable.delete("openai_api_key").is_ok());
    let missing = KeyringStore {
        factory: |_: &str| Ok(entry(None, None)),
    };
    assert!(missing.delete("openai_api_key").is_ok());
    let failed = KeyringStore {
        factory: |_: &str| {
            Ok(entry(
                None,
                Some(Error::Invalid("synthetic-private".into(), "details".into())),
            ))
        },
    };
    assert!(failed.write("openai_api_key", "synthetic-token").is_err());
    assert!(failed.delete("openai_api_key").is_err());
}

#[test]
fn entry_creation_failures_stop_operations_and_native_factory_rejects_unsupported_names() {
    let failed = KeyringStore {
        factory: |_: &str| -> Result<MockCredential, String> { Err("synthetic-private".into()) },
    };
    assert!(failed.read("openai_api_key").is_err());
    assert!(failed.write("openai_api_key", "synthetic-token").is_err());
    assert!(failed.delete("openai_api_key").is_err());
    assert!(NATIVE_STORE.read("unsupported").is_err());
    assert!(NATIVE_STORE
        .write("unsupported", "synthetic-token")
        .is_err());
    assert!(NATIVE_STORE.delete("unsupported").is_err());
}

#[test]
fn entry_creation_failures_are_reported_without_backend_details() {
    assert_eq!(
        super::secure_store::entry_error(keyring::Error::NoEntry),
        "Unable to access the system credential store."
    );
}
