use super::link_context::context_words;
use super::link_context_redaction::redact_context_word;
use scraper::{Html, Selector};

#[test]
fn redacts_emails_long_numbers_and_tokens_but_keeps_words() {
    assert_eq!(redact_context_word("jan@example.com,"), "[email]");
    assert_eq!(redact_context_word("+48123456789"), "[number]");
    assert_eq!(
        redact_context_word("build9f8a7b6c5d4e3f2a1b0c9d8e7"),
        "[token]"
    );
    assert_eq!(redact_context_word("2024"), "2024");
    assert_eq!(redact_context_word("Zażółć"), "Zażółć");
    assert_eq!(
        redact_context_word("internationalization"),
        "internationalization"
    );
}

#[test]
fn context_skips_script_and_style_text_and_redacts_personal_data() {
    let doc = Html::parse_document(
        "<div>Write to jan@example.com <script>var key='x';</script><style>.a{}</style>\
         or call 600700800 <a href=/x>here</a> <noscript>enable js</noscript> today</div>",
    );
    let sel = Selector::parse("a").unwrap();
    let (before, after) = context_words(&doc.select(&sel).next().unwrap());
    assert_eq!(before.as_deref(), Some("Write to [email] or call [number]"));
    assert_eq!(after.as_deref(), Some("today"));
}
