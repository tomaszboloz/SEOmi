pub fn split_xpath_and(predicate: &str) -> Option<Vec<&str>> {
    let bytes = predicate.as_bytes();
    let mut parts = Vec::new();
    let mut start = 0;
    let mut quote = None;
    let mut depth = 0usize;
    let mut index = 0;
    while index < bytes.len() {
        let character = bytes[index] as char;
        if let Some(active_quote) = quote {
            if character == active_quote {
                quote = None;
            }
            index += 1;
            continue;
        }
        if character == '\'' || character == '"' {
            quote = Some(character);
            index += 1;
            continue;
        }
        match character {
            '(' => depth += 1,
            ')' => depth = depth.saturating_sub(1),
            _ => {}
        }
        if depth == 0
            && bytes[index..].starts_with(b"and")
            && (index == 0 || bytes[index - 1].is_ascii_whitespace())
            && (index + 3 == bytes.len() || bytes[index + 3].is_ascii_whitespace())
        {
            parts.push(predicate[start..index].trim());
            start = index + 3;
            index += 3;
            continue;
        }
        index += 1;
    }
    if parts.is_empty() {
        None
    } else {
        parts.push(predicate[start..].trim());
        Some(parts)
    }
}

pub fn xpath_literal(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.len() < 2 {
        return Err("Wartość XPath musi być ujęta w apostrofy lub cudzysłowy.".into());
    }
    let quote = value.as_bytes()[0] as char;
    if !matches!(quote, '\'' | '"') || value.as_bytes()[value.len() - 1] as char != quote {
        return Err("Wartość XPath musi być ujęta w apostrofy lub cudzysłowy.".into());
    }
    let literal = &value[1..value.len() - 1];
    if literal.contains(quote) {
        return Err("Literał XPath zawiera niezamknięte cytowanie.".into());
    }
    Ok(literal.to_owned())
}

pub fn xpath_predicate_end(value: &str) -> Option<usize> {
    let mut quote = None;
    for (index, character) in value.char_indices() {
        if let Some(active_quote) = quote {
            if character == active_quote {
                quote = None;
            }
        } else if matches!(character, '\'' | '"') {
            quote = Some(character);
        } else if character == ']' {
            return Some(index);
        }
    }
    None
}

pub fn escape_css_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

pub fn normalize_xpath_space(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn is_xpath_name_char(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '*' | '_' | '-' | ':')
}
