fn main() {
    tauri_build::build();

    // Tauri's resource compiler links its manifest to binaries only. Cargo
    // examples and unit-test harnesses import rfd's TaskDialogIndirect and need Common Controls v6
    // before Windows resolves their imports, otherwise startup fails 0xC0000139.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        let manifest = std::path::PathBuf::from(
            std::env::var_os("CARGO_MANIFEST_DIR").expect("Cargo supplies the package directory"),
        )
        .join("windows-examples.manifest");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
}
