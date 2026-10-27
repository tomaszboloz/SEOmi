pub(super) type BrowserLauncher = fn(&str) -> Result<(), String>;

pub(super) fn send_browser_to(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("rundll32.exe")
        .arg("url.dll,FileProtocolHandler")
        .arg(url)
        .spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let result: Result<std::process::Child, std::io::Error> = Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Unsupported platform",
    ));
    result
        .map(|_| ())
        .map_err(|error| format!("Unable to open the system browser: {error}"))
}
