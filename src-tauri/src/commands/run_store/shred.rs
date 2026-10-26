//! Crypto-shredding (issue #136): subject records are encrypted with a
//! per-subject key; erasure destroys the key and physically deletes rows.

use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use rusqlite::{params, Connection, OptionalExtension};

use super::records;

fn random<const N: usize>() -> Result<[u8; N], String> {
    let mut bytes = [0u8; N];
    getrandom::fill(&mut bytes).map_err(|error| format!("Random source failed: {error}"))?;
    Ok(bytes)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub(super) fn db(error: rusqlite::Error) -> String {
    format!("Store error: {error}")
}

/// Existing key for the subject, or a fresh random 256-bit key.
fn subject_key(
    conn: &Connection,
    project: &str,
    subject: &str,
) -> Result<(String, Vec<u8>), String> {
    let found = conn
        .query_row(
            "SELECT key_id, key FROM subject_keys WHERE project_id = ?1 AND subject_id = ?2",
            params![project, subject],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Vec<u8>>(1)?)),
        )
        .optional()
        .map_err(db)?;
    if let Some(found) = found {
        return Ok(found);
    }
    let (key_id, key) = (hex(&random::<8>()?), random::<32>()?.to_vec());
    conn.execute(
        "INSERT INTO subject_keys VALUES (?1, ?2, ?3, ?4)",
        params![key_id, project, subject, key],
    )
    .map_err(db)?;
    Ok((key_id, key))
}

pub fn put_encrypted(
    conn: &Connection,
    project: &str,
    kind: &str,
    key: &str,
    subject: &str,
    data: &[u8],
) -> Result<(), String> {
    let (key_id, secret) = subject_key(conn, project, subject)?;
    let nonce = random::<12>()?;
    let encryption_key =
        Key::try_from(secret.as_slice()).map_err(|_| "Encryption failed.".to_string())?;
    let nonce = Nonce::try_from(nonce.as_slice()).map_err(|_| "Encryption failed.".to_string())?;
    let cipher = ChaCha20Poly1305::new(&encryption_key);
    let sealed = cipher
        .encrypt(&nonce, data)
        .map_err(|_| "Encryption failed.".to_string())?;
    let blob = [nonce.as_slice(), sealed.as_slice()].concat();
    records::put_record(conn, project, kind, key, subject, &key_id, &blob).map_err(db)
}

/// Decrypts subject records; `None` once the key was shredded or on tamper.
pub fn read_record(
    conn: &Connection,
    project: &str,
    kind: &str,
    key: &str,
) -> Result<Option<Vec<u8>>, String> {
    let row = conn
        .query_row(
            "SELECT data, key_id FROM records WHERE project_id = ?1 AND kind = ?2 AND rec_key = ?3",
            params![project, kind, key],
            |row| Ok((row.get::<_, Vec<u8>>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(db)?;
    let Some((data, key_id)) = row else {
        return Ok(None);
    };
    if key_id.is_empty() {
        return Ok(Some(data));
    }
    let secret: Option<Vec<u8>> = conn
        .query_row(
            "SELECT key FROM subject_keys WHERE key_id = ?1",
            [&key_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(db)?;
    let Some(secret) = secret.filter(|_| data.len() > 12) else {
        return Ok(None);
    };
    let Some(encryption_key) = Key::try_from(secret.as_slice()).ok() else {
        return Ok(None);
    };
    let Some(nonce) = Nonce::try_from(&data[..12]).ok() else {
        return Ok(None);
    };
    let cipher = ChaCha20Poly1305::new(&encryption_key);
    Ok(cipher.decrypt(&nonce, &data[12..]).ok())
}
