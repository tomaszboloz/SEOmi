use super::*;
const DATA: &[u8] = include_bytes!("fixtures/updater-signed.txt");
const SIGNATURE: &str = include_str!("fixtures/updater-signed.txt.sig");

#[test]
fn product_key_verifies_real_signature_and_rejects_modified_artifact() {
    let key = public_key().unwrap();
    let signature = signature(SIGNATURE).unwrap();
    key.verify(DATA, &signature, false).unwrap();
    assert!(key
        .verify(b"tampered SEOmi update", &signature, false)
        .is_err());
}

#[test]
fn checkout_line_ending_conversion_changes_signed_bytes_and_must_be_rejected() {
    let key = public_key().unwrap();
    let signature = signature(SIGNATURE).unwrap();
    assert!(DATA.ends_with(b"\n") && !DATA.ends_with(b"\r\n"));
    let converted = String::from_utf8(DATA.to_vec())
        .unwrap()
        .replace('\n', "\r\n");
    assert!(key.verify(converted.as_bytes(), &signature, false).is_err());
}

#[test]
fn malformed_and_truncated_signatures_are_rejected() {
    assert!(signature("not base64!").is_err());
    assert!(signature(&STANDARD.encode("invalid minisign signature")).is_err());
    assert!(signature(&SIGNATURE[..20]).is_err());
}

#[test]
fn streaming_verification_matches_the_updater_and_rejects_tampering() {
    let key = public_key().unwrap();
    let signature = signature(SIGNATURE).unwrap();
    let mut verifier = key.verify_stream(&signature).unwrap();
    for chunk in DATA.chunks(3) {
        verifier.update(chunk);
    }
    verifier.finalize().unwrap();
    let mut altered = key.verify_stream(&signature).unwrap();
    altered.update(DATA);
    altered.update(b"extra bytes");
    assert!(altered.finalize().is_err());
}

#[test]
fn verifies_required_package_kinds_without_treating_dmg_or_plain_exe_as_updates() {
    assert!(updater_artifact(Path::new(
        "target/bundle/macos/SEOmi.app.tar.gz"
    )));
    assert!(updater_artifact(Path::new("target/bundle/msi/SEOmi.msi")));
    assert!(updater_artifact(Path::new(
        "target\\bundle\\nsis\\SEOmi.exe"
    )));
    assert!(!updater_artifact(Path::new("target/release/seomi.exe")));
    assert!(!updater_artifact(Path::new("target/bundle/dmg/SEOmi.dmg")));
    assert!(!updater_artifact(Path::new(
        "target/bundle/macos/SEOmi.app.tar.gz.sig"
    )));
}

#[test]
fn missing_signature_and_tampered_file_cannot_pass_tree_verification() {
    let directory =
        std::env::temp_dir().join(format!("seomi-signature-test-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let artifact = directory.join("SEOmi.app.tar.gz");
    let signature_file = directory.join("SEOmi.app.tar.gz.sig");
    let key = public_key().unwrap();
    fs::write(&artifact, DATA).unwrap();
    assert!(verify_tree(&key, &directory).is_err());
    fs::write(&signature_file, SIGNATURE).unwrap();
    assert_eq!(verify_tree(&key, &directory).unwrap(), 1);
    fs::write(&artifact, b"modified artifact").unwrap();
    assert!(verify_tree(&key, &directory).is_err());
    fs::remove_dir_all(directory).unwrap();
}
