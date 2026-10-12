use super::percent_decode_robots_path;

#[test]
fn lowercase_and_uppercase_hex_escapes_decode_identically() {
    assert_eq!(percent_decode_robots_path("/a%2fb"), "/a/b");
    assert_eq!(percent_decode_robots_path("/a%2Fb"), "/a/b");
    assert_eq!(percent_decode_robots_path("/%7ea"), "/~a");
}
