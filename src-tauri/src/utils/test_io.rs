use std::{
    collections::VecDeque,
    io,
    pin::Pin,
    task::{Context, Poll},
};
use tokio::io::{AsyncRead, ReadBuf};

pub(crate) struct Packets(pub(crate) VecDeque<io::Result<Vec<u8>>>);

impl AsyncRead for Packets {
    fn poll_read(
        mut self: Pin<&mut Self>,
        _: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let Some(packet) = self.0.pop_front() else {
            return Poll::Ready(Ok(()));
        };
        match packet {
            Err(error) => Poll::Ready(Err(error)),
            Ok(mut bytes) => {
                let count = bytes.len().min(buf.remaining());
                buf.put_slice(&bytes[..count]);
                if count < bytes.len() {
                    self.0.push_front(Ok(bytes.split_off(count)));
                }
                Poll::Ready(Ok(()))
            }
        }
    }
}
