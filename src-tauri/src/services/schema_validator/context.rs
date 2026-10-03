use super::*;

pub(super) fn schema_org_iri(value: &str) -> bool {
    let Ok(url) = Url::parse(value) else {
        return false;
    };
    matches!(url.scheme(), "http" | "https")
        && url.host_str().is_some_and(|host| {
            host.eq_ignore_ascii_case("schema.org") || host.eq_ignore_ascii_case("www.schema.org")
        })
}

pub(super) fn context_contains_schema_org(context: &Value) -> bool {
    fn visit(context: &Value, depth: usize) -> bool {
        if depth > MAX_CONTEXT_DEPTH {
            return false;
        }
        match context {
            Value::String(value) => schema_org_iri(value),
            Value::Array(values) => values.iter().any(|value| visit(value, depth + 1)),
            Value::Object(values) => values.values().any(|value| {
                value.as_str().is_some_and(schema_org_iri)
                    || matches!(value, Value::Array(_) | Value::Object(_))
                        && visit(value, depth + 1)
            }),
            _ => false,
        }
    }

    visit(context, 0)
}

/// Bounded local IRI expansion; remote contexts are never fetched or guessed.
#[derive(Clone, Default)]
pub(super) struct JsonLdContext {
    pub(super) vocab: Option<String>,
    terms: HashMap<String, Option<String>>,
}

impl JsonLdContext {
    pub(super) fn apply(&mut self, value: &Value, depth: usize) {
        if depth > MAX_CONTEXT_DEPTH {
            *self = Self::default();
            return;
        }
        match value {
            Value::Null => *self = Self::default(),
            Value::String(iri) => {
                *self = Self::default();
                if schema_org_iri(iri) {
                    self.vocab = Some(format!("{}/", iri.trim_end_matches('/')));
                }
            }
            Value::Array(values) => {
                for context in values.iter().take(MAX_JSONLD_NODES) {
                    self.apply(context, depth + 1);
                }
                if values.len() > MAX_JSONLD_NODES {
                    *self = Self::default();
                }
            }
            Value::Object(values) => {
                if let Some(vocab) = values.get("@vocab") {
                    self.vocab = vocab.as_str().map(str::to_string);
                }
                for (term, definition) in values.iter().take(MAX_JSONLD_NODES) {
                    if !term.starts_with('@') {
                        let iri = definition
                            .as_str()
                            .or_else(|| definition.get("@id").and_then(Value::as_str));
                        self.terms.insert(term.clone(), iri.map(str::to_string));
                    }
                }
                if values.len() > MAX_JSONLD_NODES {
                    *self = Self::default();
                }
            }
            _ => *self = Self::default(),
        }
    }

    pub(super) fn expand(&self, value: &str, depth: usize) -> Option<String> {
        if depth > MAX_CONTEXT_DEPTH {
            return None;
        }
        if let Some(mapping) = self.terms.get(value) {
            return mapping
                .as_deref()
                .and_then(|iri| self.expand(iri, depth + 1));
        }
        if let Some((prefix, suffix)) = value.split_once(':') {
            if let Some(mapping) = self.terms.get(prefix) {
                return mapping.as_deref().map(|iri| format!("{iri}{suffix}"));
            }
            return Url::parse(value).ok().map(|_| value.to_string());
        }
        self.vocab.as_ref().map(|vocab| format!("{vocab}{value}"))
    }
}
