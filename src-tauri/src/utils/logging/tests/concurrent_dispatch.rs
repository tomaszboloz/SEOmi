use super::*;

#[test]
fn concurrent_dispatches_receive_independent_ids() {
    let ids: Vec<_> = (0..16)
        .map(|_| {
            std::thread::spawn(|| {
                let mut id = None;
                dispatch_with_sink(
                    "inspect_url",
                    || true,
                    |entry| {
                        id = Some(entry.request_id);
                        Ok(())
                    },
                );
                id.unwrap()
            })
        })
        .map(|thread| thread.join().unwrap())
        .collect();
    assert_eq!(
        ids.iter().collect::<std::collections::HashSet<_>>().len(),
        16
    );
}
