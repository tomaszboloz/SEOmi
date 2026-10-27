use super::secure_store::NativeCredentialEntry;

struct CleanupGuard {
    entry: Option<NativeCredentialEntry>,
}

impl Drop for CleanupGuard {
    fn drop(&mut self) {
        if let Some(entry) = self.entry.take() {
            let _ = entry.delete_credential();
        }
    }
}

#[test]
fn native_keyring_credential_interop_isolated_roundtrip() {
    let service = format!("so.seomi.test.credentials.interop.{}", std::process::id());
    let user = "synthetic_interop_user";
    let test_secret = "synthetic_secret_token_12345";

    let Ok(entry) = NativeCredentialEntry::new(&service, user) else {
        eprintln!("keyring::Entry::new returned error: store unavailable");
        return;
    };
    let guard = CleanupGuard { entry: Some(entry) };
    let current_entry = guard.entry.as_ref().unwrap();

    match current_entry.set_password(test_secret) {
        Ok(()) => {
            let read_back = current_entry.get_password();
            assert_eq!(read_back.as_deref().ok(), Some(test_secret));

            let delete_result = current_entry.delete_credential();
            assert!(delete_result.is_ok());

            let after_delete = current_entry.get_password();
            assert!(matches!(after_delete, Err(keyring::Error::NoEntry)));
        }
        Err(keyring::Error::NoDefaultStore)
        | Err(keyring::Error::NoStorageAccess(_))
        | Err(keyring::Error::PlatformFailure(_)) => {
            eprintln!(
                "Native credential backend unavailable in this environment; \
                 recording unavailable without faking mock success."
            );
        }
        Err(other) => {
            panic!("Unexpected error from native credential backend: {other:?}");
        }
    }
}

#[test]
fn native_keyring_nonexistent_credential_reports_no_entry_or_unavailable() {
    let service = format!(
        "so.seomi.test.credentials.nonexistent.{}",
        std::process::id()
    );
    let user = "synthetic_absent_user";

    let Ok(entry) = NativeCredentialEntry::new(&service, user) else {
        return;
    };
    match entry.get_password() {
        Err(keyring::Error::NoEntry) => {}
        Err(keyring::Error::NoDefaultStore)
        | Err(keyring::Error::NoStorageAccess(_))
        | Err(keyring::Error::PlatformFailure(_)) => {
            eprintln!("Native credential backend unavailable in this environment.");
        }
        Ok(unexpected) => {
            panic!("Unexpected existing credential in test namespace: {unexpected:?}");
        }
        Err(other) => {
            panic!("Unexpected error from native credential backend: {other:?}");
        }
    }
}
