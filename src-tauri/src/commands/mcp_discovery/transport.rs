use super::{protocol::read_protocol_line, MAX_PROTOCOL_LINES, MAX_PROTOCOL_LINE_BYTES};
use std::{
    io::{BufRead, BufReader},
    process::{Child, ChildStdout},
    sync::mpsc::{self, Receiver, SyncSender},
    thread,
};

pub(super) struct OwnedChild(pub Child);

impl Drop for OwnedChild {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

pub(super) fn bounded_protocol_reader(
    mut reader: impl BufRead,
    sender: SyncSender<Result<Vec<u8>, String>>,
) {
    let mut remaining = MAX_PROTOCOL_LINE_BYTES;
    for _ in 0..MAX_PROTOCOL_LINES {
        match read_protocol_line(&mut reader, remaining) {
            Ok(None) => return,
            Ok(Some(line)) => {
                remaining -= line.len();
                if sender.send(Ok(line)).is_err() {
                    return;
                }
            }
            Err(error) => {
                let _ = sender.send(Err(error));
                return;
            }
        }
    }
    let _ = sender.send(Err(
        "MCP server exceeded the discovery protocol message limit.".into(),
    ));
}

pub(super) fn protocol_receiver(stdout: ChildStdout) -> Receiver<Result<Vec<u8>, String>> {
    let (sender, receiver) = mpsc::sync_channel(1);
    thread::spawn(move || bounded_protocol_reader(BufReader::new(stdout), sender));
    receiver
}
