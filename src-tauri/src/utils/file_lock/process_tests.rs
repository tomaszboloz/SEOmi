use super::*;
use std::{
    fs,
    process::{Child, Command, Stdio},
    time::Duration,
};

struct ChildGuard(Child);

impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[test]
fn lock_holder_child() {
    let Some(path) = std::env::var_os("SEOMI_FILE_LOCK_CHILD") else {
        return;
    };
    let ready = std::env::var_os("SEOMI_FILE_LOCK_READY").expect("child readiness path");
    let _lock = acquire_file_lock(Path::new(&path))
        .unwrap()
        .expect("child lock");
    fs::write(ready, b"locked").unwrap();
    loop {
        std::thread::park();
    }
}

#[tokio::test]
async fn process_termination_releases_os_lock_without_deleting_the_file() {
    let directory =
        std::env::temp_dir().join(format!("seomi-lock-process-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("task.lock");
    let ready = directory.join("ready");
    let child = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "utils::file_lock::process_tests::lock_holder_child",
            "--nocapture",
        ])
        .env("SEOMI_FILE_LOCK_CHILD", &path)
        .env("SEOMI_FILE_LOCK_READY", &ready)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let mut child = ChildGuard(child);
    tokio::time::timeout(Duration::from_secs(10), async {
        while !ready.exists() {
            assert!(
                child.0.try_wait().unwrap().is_none(),
                "lock holder exited before readiness"
            );
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("lock holder readiness");
    assert_eq!(fs::read(&ready).unwrap(), b"locked");
    assert!(acquire_file_lock(&path).unwrap().is_none());
    child.0.kill().unwrap();
    child.0.wait().unwrap();
    assert!(path.exists());
    let reclaimed = acquire_file_lock(&path)
        .unwrap()
        .expect("OS released crashed owner");
    assert!(acquire_file_lock(&path).unwrap().is_none());
    drop(reclaimed);
    fs::remove_dir_all(directory).unwrap();
}
