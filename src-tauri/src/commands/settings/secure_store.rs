use super::secret_names::is_supported_secret_name;

const KEYRING_SERVICE: &str = "so.seomi.desktop";

pub(super) trait SecureStore {
    fn read(&self, name: &str) -> Result<Option<String>, ()>;
    fn write(&self, name: &str, value: &str) -> Result<(), ()>;
    fn delete(&self, name: &str) -> Result<(), ()>;
}

pub(super) struct KeyringStore<F> {
    pub factory: F,
}

type EntryFactory = fn(&str) -> Result<keyring::Entry, String>;
pub(super) const NATIVE_STORE: KeyringStore<EntryFactory> = KeyringStore {
    factory: secret_entry,
};

pub(crate) fn secret_entry(name: &str) -> Result<keyring::Entry, String> {
    if !is_supported_secret_name(name) {
        return Err("Unsupported secure setting.".into());
    }
    keyring::Entry::new(KEYRING_SERVICE, name)
        .map_err(|_| "Unable to access the system credential store.".into())
}

impl<F: Fn(&str) -> Result<keyring::Entry, String>> SecureStore for KeyringStore<F> {
    fn read(&self, name: &str) -> Result<Option<String>, ()> {
        match (self.factory)(name).map_err(|_| ())?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(()),
        }
    }

    fn write(&self, name: &str, value: &str) -> Result<(), ()> {
        (self.factory)(name)
            .map_err(|_| ())?
            .set_password(value)
            .map_err(|_| ())
    }

    fn delete(&self, name: &str) -> Result<(), ()> {
        match (self.factory)(name).map_err(|_| ())?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(()),
        }
    }
}
