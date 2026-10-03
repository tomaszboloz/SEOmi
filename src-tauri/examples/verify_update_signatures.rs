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
#[path = "verify_update_signatures_tests.rs"]
mod tests;
