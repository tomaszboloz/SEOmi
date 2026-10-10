#[derive(Default)]
pub(super) struct CspPolicy {
    default_sources: Option<Vec<String>>,
    script_sources: Option<Vec<String>>,
    script_element_sources: Option<Vec<String>>,
    strict_dynamic_script: bool,
    strict_dynamic_element: bool,
}

impl CspPolicy {
    pub(super) fn has_script_fallback(&self) -> bool {
        self.default_sources.is_some() || self.script_sources.is_some()
    }

    pub(super) fn script_scope(&self) -> Option<&Vec<String>> {
        self.script_element_sources
            .as_ref()
            .or(self.script_sources.as_ref())
            .or(self.default_sources.as_ref())
    }

    pub(super) fn allows(&self, token: &str) -> bool {
        // eval is governed by script-src/default-src; script-src-elem only
        // narrows executable element sources.
        let (sources, strict_dynamic) = if token == "'unsafe-eval'" {
            (
                self.script_sources
                    .as_ref()
                    .or(self.default_sources.as_ref()),
                self.strict_dynamic_script,
            )
        } else if self.script_element_sources.is_some() {
            (
                self.script_element_sources.as_ref(),
                self.strict_dynamic_element,
            )
        } else {
            (self.script_scope(), self.strict_dynamic_script)
        };
        sources.map_or(true, |sources| {
            let trusted_script = sources.iter().any(|source| is_nonce_or_hash(source));
            if token == "'unsafe-inline'" && trusted_script {
                return false;
            }
            if (token == "*" || token == "data:") && trusted_script && strict_dynamic {
                return false;
            }
            sources.iter().any(|source| source_matches(source, token))
        })
    }
}

pub(super) fn parse_csp(value: &str) -> CspPolicy {
    let mut default = None;
    let mut script = None;
    let mut script_element = None;
    let mut strict_dynamic_script = false;
    let mut strict_dynamic_element = false;
    for directive in value.split(';') {
        let mut words = directive.split_whitespace();
        let Some(name) = words.next().map(str::to_ascii_lowercase) else {
            continue;
        };
        let sources = words.map(str::to_owned).collect::<Vec<_>>();
        match name.as_str() {
            "default-src" if default.is_none() => default = Some(sources),
            "script-src" if script.is_none() => {
                strict_dynamic_script = sources
                    .iter()
                    .any(|source| source.eq_ignore_ascii_case("'strict-dynamic'"));
                script = Some(sources);
            }
            "script-src-elem" if script_element.is_none() => {
                strict_dynamic_element = sources
                    .iter()
                    .any(|source| source.eq_ignore_ascii_case("'strict-dynamic'"));
                script_element = Some(sources);
            }
            _ => {}
        }
    }
    CspPolicy {
        default_sources: default,
        script_sources: script,
        script_element_sources: script_element,
        strict_dynamic_script,
        strict_dynamic_element,
    }
}

pub(super) fn source_matches(source: &str, token: &str) -> bool {
    match token {
        "*" => source == "*" || source.contains('*'),
        "data:" => source.eq_ignore_ascii_case("data:"),
        _ => source.eq_ignore_ascii_case(token),
    }
}

pub(super) fn is_nonce_or_hash(source: &str) -> bool {
    let normalized = source.to_ascii_lowercase();
    let nonce = normalized
        .strip_prefix("'nonce-")
        .and_then(|value| value.strip_suffix('\''))
        .is_some_and(|value| !value.is_empty());
    let hash = ["'sha256-", "'sha384-", "'sha512-"].iter().any(|prefix| {
        normalized
            .strip_prefix(prefix)
            .and_then(|value| value.strip_suffix('\''))
            .is_some_and(|value| !value.is_empty())
    });
    nonce || hash
}
