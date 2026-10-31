//! Real process-kill test for the crawl event log (#138): a child process appends
//! events to a file-backed store, the parent kills it mid-crawl (SIGKILL on Unix,
//! TerminateProcess on Windows), then reopens the store as a restarted app would.
use seomi_lib::commands::run_store::{event_read, events::StoredEvent, schema};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

const PROJECT: &str = "p1";
const RUN: &str = "r1";
const CHILD_ENV: &str = "SEOMI_KILL_TEST_DB";

fn event(seq: i64, kind: &str) -> StoredEvent {
    StoredEvent {
        seq,
        kind: kind.into(),
        at_ms: 1_000 + seq,
        payload: json!({ "n": seq }),
    }
}

/// Child role: append forever, report each committed seq on stdout.
fn crawl_until_killed(db: &str) {
    let mut conn = schema::open(std::path::Path::new(db)).expect("open store");
    let mut seq = 1;
    loop {
        let kind = if seq == 1 { "started" } else { "page" };
        seomi_lib::commands::run_store::events::append(&mut conn, PROJECT, RUN, &event(seq, kind))
            .expect("append");
        println!("{seq}");
        seq += 1;
    }
}

#[test]
fn killed_crawl_is_recoverable_after_restart() {
    if let Ok(db) = std::env::var(CHILD_ENV) {
        return crawl_until_killed(&db);
    }
    let dir = std::env::temp_dir().join(format!("seomi-kill-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let db = dir.join("store.sqlite3");
    let mut child = Command::new(std::env::current_exe().unwrap())
        .args([
            "killed_crawl_is_recoverable_after_restart",
            "--exact",
            "--nocapture",
        ])
        .env(CHILD_ENV, &db)
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let mut lines = BufReader::new(child.stdout.take().unwrap()).lines();
    let mut committed = 0i64;
    while committed < 50 {
        if let Ok(n) = lines
            .next()
            .expect("child exited early")
            .unwrap()
            .trim()
            .parse::<i64>()
        {
            committed = n;
        }
    }
    child.kill().unwrap();
    child.wait().unwrap();

    // "Restart": a fresh connection must open the store, see the open run and close it.
    let mut conn = schema::open(&db).expect("reopen after kill");
    let open = event_read::open_runs(&conn, PROJECT).unwrap();
    assert_eq!(open.len(), 1);
    assert_eq!(open[0].run_id, RUN);
    assert!(
        open[0].last_seq >= committed,
        "no committed event may be lost"
    );
    let page = event_read::load(&conn, PROJECT, RUN, 0, 500).unwrap();
    let seqs: Vec<i64> = page.events.iter().map(|e| e.seq).collect();
    assert_eq!(
        seqs,
        (1..=seqs.len() as i64).collect::<Vec<_>>(),
        "sequence has no gap"
    );
    assert_eq!(page.events[0].kind, "started");
    event_read::close_interrupted(&mut conn, PROJECT, RUN, 9_999).unwrap();
    assert!(event_read::open_runs(&conn, PROJECT).unwrap().is_empty());
    let last = event_read::load(&conn, PROJECT, RUN, open[0].last_seq, 10).unwrap();
    assert_eq!(last.events[0].kind, "interrupted");
    assert_eq!(last.events[0].payload, Value::Null);
    drop(conn);
    std::fs::remove_dir_all(dir).unwrap();
}
