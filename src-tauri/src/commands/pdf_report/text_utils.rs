pub fn ascii_pdf_text(value: &str) -> String {
    value
        .chars()
        .map(|character| match character {
            'ą' | 'Ą' => 'a',
            'ć' | 'Ć' => 'c',
            'ę' | 'Ę' => 'e',
            'ł' | 'Ł' => 'l',
            'ń' | 'Ń' => 'n',
            'ó' | 'Ó' => 'o',
            'ś' | 'Ś' => 's',
            'ż' | 'Ż' | 'ź' | 'Ź' => 'z',
            '\\' => '\\',
            '(' => '(',
            ')' => ')',
            character if character.is_ascii_graphic() || character == ' ' => character,
            _ => '?',
        })
        .collect()
}

pub fn pdf_literal(value: &str) -> String {
    ascii_pdf_text(value)
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

pub fn wrapped_lines(value: &str, width: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in value.split_whitespace() {
        if !current.is_empty() && current.len() + word.len() + 1 > width {
            lines.push(current);
            current = String::new();
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }
    if !current.is_empty() {
        lines.push(current);
    }
    if lines.is_empty() {
        lines.push("-".into());
    }
    lines
}
