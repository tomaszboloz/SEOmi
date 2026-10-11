use super::*;

#[test]
fn blank_custom_values_fall_back_to_the_default_profile() {
    assert_eq!(resolve_user_agent(Some("   ")), UA_CHROME_MAC);
    assert_eq!(resolve_user_agent(Some("")), UA_CHROME_MAC);
    assert_eq!(resolve_user_agent(Some(" Bot/1 ")), "Bot/1");
}
