use super::*;

#[test]
fn concurrent_dispatches_receive_independent_ids() {
    // Production code registers the shared span callsites here without a scoped
    // subscriber; the global one keeps their cached Interest from becoming never.
    init();
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
