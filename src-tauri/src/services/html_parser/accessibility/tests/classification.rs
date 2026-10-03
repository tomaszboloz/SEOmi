use super::*;

#[test]
fn antispam_classification_requires_explicit_marker_or_hidden_conventional_name() {
    let doc = Html::parse_document("<input name='website'><input name='website' hidden><input class='contact-honeytrap'><input name='email' hidden><input name='bot-field'>");
    let selector = Selector::parse("input").unwrap();
    let controls = doc.select(&selector).collect::<Vec<_>>();
    assert!(!is_marked_anti_spam_text_control(&controls[0]));
    assert!(!is_explicitly_marked_anti_spam_control(&controls[0]));
    assert!(!is_hidden_conventional_anti_spam_field(&controls[0]));
    assert!(is_hidden_conventional_anti_spam_field(&controls[1]));
    assert!(is_marked_anti_spam_text_control(&controls[1]));
    assert!(is_explicitly_marked_anti_spam_control(&controls[2]));
    assert!(!is_marked_anti_spam_text_control(&controls[3]));
    assert!(is_explicitly_marked_anti_spam_control(&controls[4]));
}

#[test]
fn static_focus_blocking_preserves_difference_from_visual_honeypot_hiding() {
    for style in [
        "display:none",
        "VISIBILITY: hidden !important",
        "content-visibility:hidden",
        "opacity:0",
        "left:-999px",
    ] {
        assert!(style_hides_control(style), "{style}");
    }
    for style in [
        "color:red",
        "display:block",
        "opacity:0.5",
        "left:1px",
        "malformed",
    ] {
        assert!(!style_hides_control(style), "{style}");
    }
    let doc = Html::parse_document("<div inert><button>A</button></div><button style='opacity:0'>B</button><button hidden>C</button>");
    let selector = Selector::parse("button").unwrap();
    let buttons = doc.select(&selector).collect::<Vec<_>>();
    assert!(focusability_blocked_by_markup(&buttons[0]));
    assert!(!focusability_blocked_by_markup(&buttons[1]));
    assert!(focusability_blocked_by_markup(&buttons[2]));
}

#[test]
fn language_shape_accepts_private_use_and_rejects_empty_or_invalid_subtags() {
    for value in ["pl", "en-US", "zh-Hant-TW", "x-private", "i-klingon"] {
        assert!(is_structurally_valid_language_tag(value), "{value}");
    }
    for value in [
        "",
        "p",
        "x",
        "pl_",
        "en-",
        "-US",
        "123",
        "abcdefghi",
        "pl-abcdefghi",
    ] {
        assert!(!is_structurally_valid_language_tag(value), "{value}");
    }
}
