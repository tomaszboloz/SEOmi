use super::secret_names::is_supported_secret_name;

#[cfg(not(test))]
const KEYRING_SERVICE: &str = "so.seomi.desktop";

pub(super) trait SecureStore {
    fn read(&self, name: &str) -> Result<Option<String>, ()>;
    fn write(&self, name: &str, value: &str) -> Result<(), ()>;
    fn delete(&self, name: &str) -> Result<(), ()>;
}

pub(super) trait CredentialEntry {
    fn get_password(&self) -> Result<String, keyring::Error>;
    fn set_password(&self, password: &str) -> Result<(), keyring::Error>;
    fn delete_credential(&self) -> Result<(), keyring::Error>;
}

pub(crate) struct NativeCredentialEntry(keyring::Entry);

impl NativeCredentialEntry {
    #[cfg(test)]
    pub(crate) fn new(service: &str, user: &str) -> Result<Self, keyring::Error> {
        keyring::Entry::new(service, user).map(Self)
    }

    pub(crate) fn get_password(&self) -> Result<String, keyring::Error> {
        self.0.get_password()
    }

    pub(crate) fn set_password(&self, password: &str) -> Result<(), keyring::Error> {
        self.0.set_password(password)
    }

    pub(crate) fn delete_credential(&self) -> Result<(), keyring::Error> {
        self.0.delete_credential()
    }
}

impl CredentialEntry for NativeCredentialEntry {
    fn get_password(&self) -> Result<String, keyring::Error> {
        NativeCredentialEntry::get_password(self)
    }

    fn set_password(&self, password: &str) -> Result<(), keyring::Error> {
        NativeCredentialEntry::set_password(self, password)
    }

    fn delete_credential(&self) -> Result<(), keyring::Error> {
        NativeCredentialEntry::delete_credential(self)
    }
}

pub(super) struct KeyringStore<F> {
    pub factory: F,
}

type EntryFactory = fn(&str) -> Result<NativeCredentialEntry, String>;
pub(super) const NATIVE_STORE: KeyringStore<EntryFactory> = KeyringStore {
    factory: secret_entry,
};

pub(crate) fn secret_entry(name: &str) -> Result<NativeCredentialEntry, String> {
    if !is_supported_secret_name(name) {
        return Err("Unsupported secure setting.".into());
    }
    #[cfg(test)]
    let test_service = format!("so.seomi.desktop.tests.{}", std::process::id());
    #[cfg(test)]
    let service = test_service.as_str();
    #[cfg(not(test))]
    let service = KEYRING_SERVICE;
    keyring::Entry::new(service, name)
        .map(NativeCredentialEntry)
        .map_err(entry_error)
}

pub(super) fn entry_error(_: keyring::Error) -> String {
    "Unable to access the system credential store.".into()
}

impl<F, E> SecureStore for KeyringStore<F>
where
    F: Fn(&str) -> Result<E, String>,
    E: CredentialEntry,
{
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
