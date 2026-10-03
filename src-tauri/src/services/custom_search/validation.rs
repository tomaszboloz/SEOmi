use super::models::{CustomSearchDefinition, XPathTerminal, MAX_CUSTOM_SEARCHES};
use super::xpath::xpath_to_css;
use regex::Regex;
use scraper::Selector;

pub fn validate_custom_searches(searches: &[CustomSearchDefinition]) -> Result<(), String> {
    if searches.len() > MAX_CUSTOM_SEARCHES {
        return Err(format!(
            "Można skonfigurować maksymalnie {MAX_CUSTOM_SEARCHES} wyszukiwań na crawl."
        ));
    }

    let mut ids = std::collections::HashSet::new();
    for search in searches {
        if search.id.trim().is_empty() || !ids.insert(search.id.trim()) {
            return Err("Każde wyszukiwanie musi mieć unikalny identyfikator.".into());
        }
        if search.name.trim().is_empty() || search.name.chars().count() > 80 {
            return Err(
                "Nazwa wyszukiwania jest wymagana i może mieć maksymalnie 80 znaków.".into(),
            );
        }
        if search.query.trim().is_empty() || search.query.chars().count() > 512 {
            return Err(
                "Zapytanie selektora jest wymagane i może mieć maksymalnie 512 znaków.".into(),
            );
        }
        let mode = search.selector_type.trim().to_ascii_lowercase();
        let output = search.result_type.trim().to_ascii_lowercase();
        if !matches!(mode.as_str(), "css" | "xpath" | "regex") {
            return Err(format!(
                "Nieobsługiwany typ selektora: {}.",
                search.selector_type
            ));
        }
        if !matches!(output.as_str(), "text" | "html" | "attribute") {
            return Err(format!(
                "Nieobsługiwany typ wyniku: {}.",
                search.result_type
            ));
        }
        if mode == "regex" {
            if output != "text" {
                return Err(format!(
                    "Wyszukiwanie regex „{}” wymaga typu wyniku Text.",
                    search.name
                ));
            }
            Regex::new(search.query.trim()).map_err(|error| {
                format!("Niepoprawne wyrażenie regex „{}”: {error}.", search.name)
            })?;
            continue;
        }
        if output == "attribute"
            && search
                .attribute
                .as_deref()
                .map_or(true, |attribute| !is_valid_attribute_name(attribute.trim()))
            && mode == "css"
        {
            return Err(format!(
                "Wyszukiwanie „{}” wymaga poprawnej nazwy atrybutu.",
                search.name
            ));
        }
        if mode == "css" {
            Selector::parse(search.query.trim())
                .map_err(|error| format!("Niepoprawny selektor CSS „{}”: {error}.", search.name))?;
        } else {
            let selector = xpath_to_css(search.query.trim())?;
            match selector.terminal {
                XPathTerminal::Text if output != "text" => {
                    return Err(format!(
                        "Wyszukiwanie XPath „{}” kończy się /text() i wymaga typu wyniku Text.",
                        search.name
                    ));
                }
                XPathTerminal::Attribute(_) if output != "attribute" => {
                    return Err(format!(
                        "Wyszukiwanie XPath „{}” kończy się /@atrybut i wymaga typu wyniku Attribute.",
                        search.name
                    ));
                }
                _ => {}
            }
        }
    }
    Ok(())
}

pub fn is_valid_attribute_name(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b':'))
}
