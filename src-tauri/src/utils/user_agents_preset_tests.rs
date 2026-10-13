use super::*;

#[test]
fn every_named_preset_resolves_to_its_constant() {
    let presets = [
        ("chrome_mac", UA_CHROME_MAC),
        ("chrome_win", UA_CHROME_WIN),
        ("safari_mac", UA_SAFARI_MAC),
        ("iphone", UA_IPHONE),
    ];
    for (key, expected) in presets {
        assert_eq!(resolve_user_agent(Some(key)), expected);
    }
}
