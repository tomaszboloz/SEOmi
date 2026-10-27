use super::{erase, records, report, runs, schema, shred};
use serde_json::json;

const MARKER: &[u8] = b"DR-JANE-DOE-SECRET-PROFILE";

fn temp_db(name: &str) -> (std::path::PathBuf, std::path::PathBuf) {
    let dir = std::env::temp_dir().join(format!("seomi-erase-{name}-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    (dir.clone(), dir.join("s.sqlite3"))
}

fn all_bytes(dir: &std::path::Path) -> Vec<u8> {
    std::fs::read_dir(dir)
        .unwrap()
        .flat_map(|entry| std::fs::read(entry.unwrap().path()).unwrap())
        .collect()
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack
        .windows(needle.len())
        .any(|window| window == needle)
}

#[test]
fn subject_records_are_encrypted_at_rest_and_round_trip() {
    let (dir, path) = temp_db("enc");
    let conn = schema::open(&path).unwrap();
    shred::put_encrypted(&conn, "p1", "author", "a1", "jane", MARKER).unwrap();
    shred::put_encrypted(&conn, "p1", "author", "a2", "jane", b"second").unwrap();
    assert_eq!(
        shred::read_record(&conn, "p1", "author", "a1")
            .unwrap()
            .unwrap(),
        MARKER
    );
    let keys: i64 = conn
        .query_row("SELECT COUNT(*) FROM subject_keys", [], |r| r.get(0))
        .unwrap();
    assert_eq!(keys, 1);
    conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))
        .unwrap();
    assert!(!contains(&all_bytes(&dir), MARKER));
    records::put_record(&conn, "p1", "plain", "k", "", "", b"visible").unwrap();
    assert_eq!(
        shred::read_record(&conn, "p1", "plain", "k")
            .unwrap()
            .unwrap(),
        b"visible"
    );
    assert!(shred::read_record(&conn, "p1", "plain", "none")
        .unwrap()
        .is_none());
    drop(conn);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn forgetting_a_subject_shreds_key_rows_runs_and_logs_evidence() {
    let (dir, path) = temp_db("forget");
    let mut conn = schema::open(&path).unwrap();
    shred::put_encrypted(&conn, "p1", "author", "a1", "jane", MARKER).unwrap();
    shred::put_encrypted(&conn, "p1", "author", "b1", "john", b"keep").unwrap();
    let run = json!({"id": "r1", "subjectId": "jane", "completedAt": "x", "startUrl": "u",
        "result": {"pages": [{"url": "https://e.test/DR-JANE-DOE-SECRET-PROFILE"}]}});
    runs::save_run(&mut conn, "p1", &run).unwrap();
    runs::save_run(
        &mut conn,
        "p1",
        &json!({"id": "r2", "completedAt": "x", "startUrl": "u", "result": {"pages": []}}),
    )
    .unwrap();

    let result = erase::forget_subject(&mut conn, "p1", "jane").unwrap();
    assert_eq!((result.records_deleted, result.runs_deleted), (1, 1));
    assert!(!result.key_id.is_empty());
    assert!(shred::read_record(&conn, "p1", "author", "a1")
        .unwrap()
        .is_none());
    assert_eq!(
        shred::read_record(&conn, "p1", "author", "b1")
            .unwrap()
            .unwrap(),
        b"keep"
    );
    assert!(runs::load_run(&conn, "p1", "r1").unwrap().is_none());
    assert!(runs::load_run(&conn, "p1", "r2").unwrap().is_some());
    assert!(!contains(&all_bytes(&dir), MARKER));
    assert!(!contains(&all_bytes(&dir), b"JANE-DOE"));
    let log = report::audit_log(&conn, "p1").unwrap();
    assert_eq!(log, vec![result]);
    assert_eq!(log[0].action, "forget_subject");
    assert!(erase::forget_subject(&mut conn, "p1", "nobody")
        .unwrap()
        .key_id
        .is_empty());
    drop(conn);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn tampered_or_truncated_ciphertext_reads_as_missing() {
    let conn = schema::open_memory().unwrap();
    shred::put_encrypted(&conn, "p1", "k", "a", "s", b"data").unwrap();
    conn.execute("UPDATE records SET data = X'0102' WHERE rec_key = 'a'", [])
        .unwrap();
    assert!(shred::read_record(&conn, "p1", "k", "a").unwrap().is_none());
    shred::put_encrypted(&conn, "p1", "k", "b", "s", b"data").unwrap();
    conn.execute(
        "UPDATE records SET data = zeroblob(40) WHERE rec_key = 'b'",
        [],
    )
    .unwrap();
    assert!(shred::read_record(&conn, "p1", "k", "b").unwrap().is_none());
}

#[test]
fn erasing_a_project_removes_everything_for_it_only() {
    let mut conn = schema::open_memory().unwrap();
    for project in ["p1", "p2"] {
        shred::put_encrypted(&conn, project, "k", "a", "s", b"x").unwrap();
        runs::save_run(&mut conn, project, &json!({"id": "r", "completedAt": "x", "startUrl": "u", "result": {"pages": [{"url": "u"}]}})).unwrap();
    }
    let result = erase::erase_project(&mut conn, "p1").unwrap();
    assert_eq!(
        (
            result.records_deleted,
            result.runs_deleted,
            result.action.as_str()
        ),
        (1, 1, "erase_project")
    );
    assert!(runs::list_runs(&conn, "p1").unwrap().is_empty());
    assert_eq!(runs::list_runs(&conn, "p2").unwrap().len(), 1);
    assert_eq!(
        shred::read_record(&conn, "p2", "k", "a").unwrap().unwrap(),
        b"x"
    );
    assert_eq!(report::audit_log(&conn, "p2").unwrap().len(), 0);
}
