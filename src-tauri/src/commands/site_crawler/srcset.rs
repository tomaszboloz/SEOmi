pub(super) fn parse_srcset_urls(srcset: &str) -> Vec<String> {
    let mut urls = Vec::new();
    let mut position = 0;
    while position < srcset.len() {
        while position < srcset.len() {
            let character = srcset[position..].chars().next().unwrap();
            if character == ',' || character.is_ascii_whitespace() {
                position += character.len_utf8();
            } else {
                break;
            }
        }
        if position >= srcset.len() {
            break;
        }

        let url_start = position;
        while position < srcset.len() {
            let character = srcset[position..].chars().next().unwrap();
            if character.is_ascii_whitespace() {
                break;
            }
            position += character.len_utf8();
        }
        let raw_url = &srcset[url_start..position];
        let url = raw_url.trim_end_matches(',');
        if !url.is_empty() {
            urls.push(url.to_string());
        }
        if raw_url.ends_with(',') {
            continue;
        }

        let mut parentheses = 0usize;
        while position < srcset.len() {
            let character = srcset[position..].chars().next().unwrap();
            position += character.len_utf8();
            match character {
                '(' => parentheses = parentheses.saturating_add(1),
                ')' => parentheses = parentheses.saturating_sub(1),
                ',' if parentheses == 0 => break,
                _ => {}
            }
        }
    }
    urls
}
