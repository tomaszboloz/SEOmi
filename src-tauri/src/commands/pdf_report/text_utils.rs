use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

fn preserve_legacy_polish_case(character: char) -> char {
    match character {
        'Ą' => 'ą',
        'Ć' => 'ć',
        'Ę' => 'ę',
        'Ł' => 'ł',
        'Ń' => 'ń',
        'Ó' => 'ó',
        'Ś' => 'ś',
        'Ź' | 'Ż' => 'ż',
        other => other,
    }
}

pub fn ascii_pdf_text(value: &str) -> String {
    let mut ascii = String::with_capacity(value.len());
    for character in value
        .chars()
        .map(preserve_legacy_polish_case)
        .nfkd()
        .filter(|character| !is_combining_mark(*character))
    {
        match character {
            'ß' => ascii.push_str("ss"),
            'ẞ' => ascii.push_str("SS"),
            'æ' => ascii.push_str("ae"),
            'Æ' => ascii.push_str("AE"),
            'œ' => ascii.push_str("oe"),
            'Œ' => ascii.push_str("OE"),
            'þ' => ascii.push_str("th"),
            'Þ' => ascii.push_str("TH"),
            'đ' | 'ð' => ascii.push('d'),
            'ħ' => ascii.push('h'),
            'ı' => ascii.push('i'),
            'ĸ' => ascii.push('k'),
            'ł' => ascii.push('l'),
            'ŧ' => ascii.push('t'),
            'ø' => ascii.push('o'),
            'Đ' | 'Ð' => ascii.push('D'),
            'Ħ' => ascii.push('H'),
            'Ŧ' => ascii.push('T'),
            'Ø' => ascii.push('O'),
            character if character.is_ascii_graphic() || character == ' ' => ascii.push(character),
            _ => ascii.push('?'),
        }
    }
    ascii
}

pub fn pdf_literal(value: &str) -> String {
    ascii_pdf_text(value)
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

pub fn wrapped_lines(value: &str, width: usize) -> Vec<String> {
    let width = width.max(1);
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in value.split_whitespace() {
        let word = ascii_pdf_text(word);
        if word.len() <= width {
            if !current.is_empty() && current.len() + word.len() + 1 > width {
                lines.push(std::mem::take(&mut current));
            }
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(&word);
            continue;
        }
        if !current.is_empty() {
            lines.push(std::mem::take(&mut current));
        }
        let mut remaining = word.as_str();
        while remaining.len() > width {
            let hard_end = width;
            let split_at = remaining[..hard_end]
                .char_indices()
                .filter(|(_, character)| matches!(character, '/' | '?' | '&' | '-' | '_' | '='))
                .map(|(index, _)| index + 1)
                .next_back()
                .unwrap_or(hard_end);
            lines.push(remaining[..split_at].to_owned());
            remaining = &remaining[split_at..];
        }
        current.push_str(remaining);
    }
    if !current.is_empty() {
        lines.push(current);
    }
    if lines.is_empty() {
        lines.push("-".into());
    }
    lines
}
