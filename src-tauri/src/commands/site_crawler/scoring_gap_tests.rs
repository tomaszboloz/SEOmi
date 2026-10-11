use super::*;

#[test]
fn capped_share_of_no_pages_is_zero() {
    assert_eq!(capped_finding_share(&[], "Critical"), 0.0);
}
