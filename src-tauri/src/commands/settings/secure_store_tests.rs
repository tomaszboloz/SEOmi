use super::secure_store::{KeyringStore, SecureStore, NATIVE_STORE};
use keyring::{mock::MockCredential, Entry, Error};

fn entry(password: Option<&str>, error: Option<Error>) -> Entry {
    let entry = Entry::new_with_credential(Box::new(MockCredential::default()));
    if let Some(password) = password {
        entry.set_password(password).unwrap();
    }
    if let Some(error) = error {
        entry
            .get_credential()
            .downcast_ref::<MockCredential>()
            .unwrap()
            .set_error(error);
    }
    entry
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
        factory: |_: &str| Err("synthetic-private".into()),
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
