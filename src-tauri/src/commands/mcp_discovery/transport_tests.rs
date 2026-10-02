use super::{
    paths::node_program,
    transport::{bounded_protocol_reader, OwnedChild},
    MAX_PROTOCOL_LINE_BYTES,
};
use std::{
    io::Cursor,
    process::{Command, Stdio},
    sync::mpsc,
    thread,
};

#[test]
fn cumulative_stream_budget_is_enforced_before_unbounded_reading() {
    let mut input = vec![b'x'; 100];
    input.push(b'\n');
    input.extend(vec![b'x'; MAX_PROTOCOL_LINE_BYTES * 2]);
    let (sender, receiver) = mpsc::sync_channel(1);
    let worker = thread::spawn(move || bounded_protocol_reader(Cursor::new(input), sender));
    assert_eq!(receiver.recv().unwrap().unwrap().len(), 101);
    assert!(receiver.recv().unwrap().unwrap_err().contains("1 MiB"));
    assert!(receiver.recv().is_err());
    worker.join().unwrap();
}

#[test]
fn notification_flood_stops_at_the_message_budget() {
    let (sender, receiver) = mpsc::sync_channel(1);
    let worker =
        thread::spawn(move || bounded_protocol_reader(Cursor::new(b"{}\n".repeat(65)), sender));
    for _ in 0..64 {
        assert_eq!(receiver.recv().unwrap().unwrap(), b"{}\n");
    }
    assert!(receiver
        .recv()
        .unwrap()
        .unwrap_err()
        .contains("message limit"));
    assert!(receiver.recv().is_err());
    worker.join().unwrap();
}

#[test]
fn disconnected_consumer_and_empty_stream_allow_the_reader_to_finish() {
    for data in [Vec::new(), b"{}\n{}\n".to_vec()] {
        let (sender, receiver) = mpsc::sync_channel(1);
        drop(receiver);
        bounded_protocol_reader(Cursor::new(data), sender);
    }
}

#[test]
fn dropping_the_child_owner_terminates_and_reaps_the_process() {
    let child = Command::new(node_program())
        .args(["-e", "setInterval(()=>{},1000)"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let pid = child.id();
    drop(OwnedChild(child));
    let alive = Command::new(node_program()).args(["-e",
        "try {process.kill(Number(process.argv[1]),0);process.kill(Number(process.argv[1]));process.exit(0)}catch{process.exit(1)}",
        &pid.to_string()]).status().unwrap().success();
    assert!(
        !alive,
        "MCP process survived its owner; fixture has been cleaned up"
    );
}
