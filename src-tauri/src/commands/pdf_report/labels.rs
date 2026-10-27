//! Report labels. English defaults come from the app's own `en.json`
//! (`pdfReport` namespace), so no English text is duplicated in Rust. The
//! frontend may pass the active language's bundle inside the payload
//! (`pdf_labels`); a missing overlay or
//! a missing key falls back to English, and an unknown key to the key itself.
//! Templates use i18next placeholders `{{0}}`, `{{1}}`.

use serde_json::Value;
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

const ENGLISH: &str = include_str!("../../../../src/i18n/locales/en.json");

type Map = HashMap<String, String>;

#[derive(Default)]
struct Overlay {
    labels: Map,
}

thread_local! {
    static ACTIVE: RefCell<Overlay> = RefCell::new(Overlay::default());
}

fn flatten(prefix: &str, value: &Value, out: &mut Map) {
    match value {
        Value::String(text) => {
            out.insert(prefix.to_owned(), text.clone());
        }
        Value::Object(map) => {
            for (key, child) in map {
                let path = if prefix.is_empty() {
                    key.clone()
                } else {
                    format!("{prefix}.{key}")
                };
                flatten(&path, child, out);
            }
        }
        _ => {}
    }
}

fn defaults() -> &'static Map {
    static DEFAULTS: OnceLock<Map> = OnceLock::new();
    DEFAULTS.get_or_init(|| {
        let mut out = Map::new();
        if let Ok(root) = serde_json::from_str::<Value>(ENGLISH) {
            flatten("", root.get("pdfReport").unwrap_or(&Value::Null), &mut out);
        }
        out
    })
}

/// Labels are leaked once per distinct text so callers can keep `&'static str`.
/// The pool is bounded by the number of labels in the supported languages.
fn intern(text: &str) -> &'static str {
    static POOL: Mutex<Option<HashSet<&'static str>>> = Mutex::new(None);
    let mut guard = POOL.lock().unwrap_or_else(|poison| poison.into_inner());
    let pool = guard.get_or_insert_with(HashSet::new);
    if let Some(known) = pool.get(text) {
        return known;
    }
    let leaked: &'static str = Box::leak(text.to_owned().into_boxed_str());
    pool.insert(leaked);
    leaked
}

/// Keeps the payload's label overlay active for the current thread.
pub struct Scope(());

impl Drop for Scope {
    fn drop(&mut self) {
        ACTIVE.with(|active| *active.borrow_mut() = Overlay::default());
    }
}

/// Activates `pdf_labels` of a report payload until dropped.
pub fn enter(payload: &Value) -> Scope {
    let mut labels = Map::new();
    if let Some(bundle) = payload.get("pdf_labels") {
        flatten("", bundle, &mut labels);
    }
    ACTIVE.with(|active| *active.borrow_mut() = Overlay { labels });
    Scope(())
}

/// Label for `key`: overlay, then English default, then the key itself.
pub fn t(key: &str) -> &'static str {
    let translated = ACTIVE.with(|active| {
        let active = active.borrow();
        active
            .labels
            .get(key)
            .filter(|text| !text.is_empty())
            .cloned()
    });
    match translated {
        Some(text) => intern(&text),
        None => defaults()
            .get(key)
            .map_or_else(|| intern(key), |s| s.as_str()),
    }
}

/// Label for `key` with `{{0}}`, `{{1}}`, ... replaced by `args`.
pub fn tf(key: &str, args: &[&str]) -> String {
    args.iter()
        .enumerate()
        .fold(t(key).to_owned(), |text, (index, value)| {
            text.replace(&format!("{{{{{index}}}}}"), value)
        })
}

/// Number of English default labels (used by consistency tests).
pub fn default_keys() -> Vec<&'static str> {
    defaults().keys().map(String::as_str).collect()
}
