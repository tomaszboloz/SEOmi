use super::secure_store::SecureStore;
use std::{cell::RefCell, collections::HashMap};

#[derive(Default)]
pub(super) struct MemoryStore {
    pub values: RefCell<HashMap<String, String>>,
    pub calls: RefCell<Vec<String>>,
    pub failed: bool,
}

impl MemoryStore {
    pub fn seed(&self, name: &str, value: &str) {
        self.values.borrow_mut().insert(name.into(), value.into());
    }
}

impl SecureStore for MemoryStore {
    fn read(&self, name: &str) -> Result<Option<String>, ()> {
        self.calls.borrow_mut().push(format!("read:{name}"));
        if self.failed {
            return Err(());
        }
        Ok(self.values.borrow().get(name).cloned())
    }

    fn write(&self, name: &str, value: &str) -> Result<(), ()> {
        self.calls.borrow_mut().push(format!("write:{name}"));
        if self.failed {
            return Err(());
        }
        self.seed(name, value);
        Ok(())
    }

    fn delete(&self, name: &str) -> Result<(), ()> {
        self.calls.borrow_mut().push(format!("delete:{name}"));
        if self.failed {
            return Err(());
        }
        self.values.borrow_mut().remove(name);
        Ok(())
    }
}
