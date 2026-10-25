use super::schema;
use rusqlite::TransactionBehavior;
use std::{
    fs,
    sync::{mpsc, Arc, Barrier},
    thread,
    time::Duration,
};

#[test]
fn simultaneous_first_opens_and_writers_wait_for_each_other() {
    let dir = std::env::temp_dir().join(format!("seomi-schema-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&dir).unwrap();
    let path = Arc::new(dir.join("store.sqlite3"));
    let start = Arc::new(Barrier::new(3));
    let opened = Arc::new(Barrier::new(3));
    let (held_tx, held_rx) = mpsc::channel();
    let (attempt_tx, attempt_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();

    let first_path = Arc::clone(&path);
    let first_start = Arc::clone(&start);
    let first_opened = Arc::clone(&opened);
    let first = thread::spawn(move || -> rusqlite::Result<()> {
        first_start.wait();
        let opened_conn = schema::open(first_path.as_ref());
        first_opened.wait();
        let mut conn = opened_conn?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute("INSERT INTO import_log VALUES ('p', 'first', 'r')", [])?;
        held_tx.send(()).unwrap();
        release_rx.recv().unwrap();
        tx.commit()
    });

    let second_path = Arc::clone(&path);
    let second_start = Arc::clone(&start);
    let second_opened = Arc::clone(&opened);
    let second = thread::spawn(move || -> rusqlite::Result<()> {
        second_start.wait();
        let opened_conn = schema::open(second_path.as_ref());
        second_opened.wait();
        let mut conn = opened_conn?;
        held_rx.recv().unwrap();
        attempt_tx.send(()).unwrap();
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute("INSERT INTO import_log VALUES ('p', 'second', 'r')", [])?;
        tx.commit()
    });

    start.wait();
    opened.wait();
    attempt_rx.recv_timeout(Duration::from_secs(2)).unwrap();
    thread::sleep(Duration::from_millis(50));
    release_tx.send(()).unwrap();
    assert!(first.join().unwrap().is_ok());
    assert!(second.join().unwrap().is_ok());

    let conn = schema::open(path.as_ref()).unwrap();
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM import_log", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 2);
    drop(conn);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn schema_migrate_idempotent_on_current_version() {
    let mut conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA user_version = 2;").unwrap();
    assert!(schema::migrate(&mut conn).is_ok());
}
