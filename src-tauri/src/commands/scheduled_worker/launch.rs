pub fn headless_launch_context() -> Option<(String, String)> {
    launch_context_from_args(&std::env::args().collect::<Vec<_>>())
}

pub(super) fn launch_context_from_args(args: &[String]) -> Option<(String, String)> {
    crate::commands::scheduler::worker_launch_context(args, "--seomi-scheduled-headless")
}
