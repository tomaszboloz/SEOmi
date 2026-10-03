pub(crate) fn is_http_token_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&byte)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_tokens_allow_ascii_letters_digits_and_only_specified_punctuation() {
        let valid =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&'*+-.^_`|~";
        for byte in 0..=u8::MAX {
            assert_eq!(
                is_http_token_byte(byte),
                valid.contains(&byte),
                "byte {byte}"
            );
        }
    }
}
