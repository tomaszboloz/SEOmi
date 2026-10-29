use old::aead::{Aead, KeyInit};
use new::aead::{Aead as NewAead, KeyInit as NewKeyInit};

fn main() {
    let key = [0x11u8; 32];
    let nonce = [0x22u8; 12];
    let plain = b"existing ciphertext compatibility";
    let old_cipher = old::ChaCha20Poly1305::new(old::Key::from_slice(&key));
    let old_sealed = old_cipher.encrypt(old::Nonce::from_slice(&nonce), plain.as_ref()).unwrap();
    let new_cipher = new::ChaCha20Poly1305::new(new::Key::from_slice(&key));
    let new_plain = new_cipher.decrypt(new::Nonce::from_slice(&nonce), old_sealed.as_ref()).unwrap();
    let new_sealed = new_cipher.encrypt(new::Nonce::from_slice(&nonce), plain.as_ref()).unwrap();
    let old_plain = old_cipher.decrypt(old::Nonce::from_slice(&nonce), new_sealed.as_ref()).unwrap();
    assert_eq!(new_plain, plain);
    assert_eq!(old_plain, plain);
    assert_eq!(old_sealed, new_sealed);
    println!(
        "old_len={} wire_equal=true key={} nonce={} ciphertext={}",
        old_sealed.len(),
        hex(&key),
        hex(&nonce),
        hex(&old_sealed)
    );
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
