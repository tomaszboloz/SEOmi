use std::collections::HashSet;

pub(super) fn is_valid_hreflang_code(value: &str) -> bool {
    if value.eq_ignore_ascii_case("x-default")
        || [
            "art-lojban",
            "cel-gaulish",
            "en-gb-oed",
            "i-ami",
            "i-bnn",
            "i-default",
            "i-enochian",
            "i-hak",
            "i-klingon",
            "i-lux",
            "i-mingo",
            "i-navajo",
            "i-pwn",
            "i-tao",
            "i-tay",
            "i-tsu",
            "no-bok",
            "no-nyn",
            "sgn-be-fr",
            "sgn-be-nl",
            "sgn-ch-de",
            "zh-guoyu",
            "zh-hakka",
            "zh-min",
            "zh-min-nan",
            "zh-xiang",
        ]
        .iter()
        .any(|tag| value.eq_ignore_ascii_case(tag))
    {
        return true;
    }

    let parts = value.split('-').collect::<Vec<_>>();
    if parts
        .iter()
        .any(|part| part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_alphanumeric()))
    {
        return false;
    }

    let primary = parts[0];
    if !(2..=8).contains(&primary.len()) || !primary.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return false;
    }

    let mut index = 1;
    if primary.len() <= 3 {
        let mut extlangs = 0;
        while index < parts.len()
            && extlangs < 3
            && parts[index].len() == 3
            && parts[index].bytes().all(|byte| byte.is_ascii_alphabetic())
        {
            index += 1;
            extlangs += 1;
        }
    }

    if index < parts.len()
        && parts[index].len() == 4
        && parts[index].bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        index += 1;
    }
    if index < parts.len()
        && ((parts[index].len() == 2
            && parts[index].bytes().all(|byte| byte.is_ascii_alphabetic()))
            || (parts[index].len() == 3 && parts[index].bytes().all(|byte| byte.is_ascii_digit())))
    {
        index += 1;
    }

    let mut variants = HashSet::new();
    while index < parts.len() {
        let part = parts[index];
        let variant = (5..=8).contains(&part.len())
            || (part.len() == 4 && part.as_bytes()[0].is_ascii_digit());
        if !variant {
            break;
        }
        if !variants.insert(part.to_ascii_lowercase()) {
            return false;
        }
        index += 1;
    }

    let mut extensions = HashSet::new();
    while index < parts.len() && parts[index].len() == 1 && !parts[index].eq_ignore_ascii_case("x")
    {
        let singleton = parts[index].to_ascii_lowercase();
        if !extensions.insert(singleton) {
            return false;
        }
        index += 1;
        let start = index;
        while index < parts.len() && (2..=8).contains(&parts[index].len()) {
            index += 1;
        }
        if index == start {
            return false;
        }
    }

    if index < parts.len() && parts[index].eq_ignore_ascii_case("x") {
        index += 1;
        let start = index;
        while index < parts.len() && (1..=8).contains(&parts[index].len()) {
            index += 1;
        }
        if index == start {
            return false;
        }
    }

    index == parts.len()
}
