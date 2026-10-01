//! Verify updater artifacts with the public key embedded in the application.
use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use std::{fs, io::Read, path::Path};

fn public_key() -> Result<PublicKey, Box<dyn std::error::Error>> {
    let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let encoded = config["plugins"]["updater"]["pubkey"]
        .as_str()
        .ok_or("Missing updater public key")?;
    Ok(PublicKey::decode(&String::from_utf8(
        STANDARD.decode(encoded)?,
    )?)?)
}

fn signature(encoded: &str) -> Result<Signature, Box<dyn std::error::Error>> {
    Ok(Signature::decode(&String::from_utf8(
        STANDARD.decode(encoded.trim())?,
    )?)?)
}

fn verify_file(
    key: &PublicKey,
    artifact: &Path,
    signature_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let signature = signature(&fs::read_to_string(signature_path)?)?;
    let mut verifier = key.verify_stream(&signature)?;
    let mut input = fs::File::open(artifact)?;
    let mut buffer = [0u8; 65536];
    loop {
        let count = input.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        verifier.update(&buffer[..count]);
    }
    verifier.finalize()?;
    Ok(())
}

fn verify_tree(key: &PublicKey, directory: &Path) -> Result<usize, Box<dyn std::error::Error>> {
    let mut count = 0;
    for entry in fs::read_dir(directory)? {
        let path = entry?.path();
        if path.is_dir() {
            count += verify_tree(key, &path)?;
        } else if updater_artifact(&path) {
            let signature_path = path.with_file_name(format!(
                "{}.sig",
                path.file_name()
                    .ok_or("Missing artifact filename")?
                    .to_string_lossy()
            ));
            // Missing signatures fail as well; finding one .sig is insufficient.
            verify_file(key, &path, &signature_path)?;
            println!("Verified updater artifact: {}", path.display());
            count += 1;
        }
    }
    Ok(count)
}

fn updater_artifact(path: &Path) -> bool {
    let normalized = path.to_string_lossy().replace('\\', "/");
    normalized.ends_with(".app.tar.gz")
        || (normalized.contains("/bundle/msi/") && normalized.ends_with(".msi"))
        || (normalized.contains("/bundle/nsis/") && normalized.ends_with(".exe"))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let directory = std::env::args().nth(1).ok_or("Pass artifact directory")?;
    let count = verify_tree(&public_key()?, Path::new(&directory))?;
    if count == 0 {
        return Err("No signed updater artifacts were produced".into());
    }
    println!("Verified {count} updater signatures using the application's public key");
    Ok(())
}

#[cfg(test)]
mod tests {
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
}
