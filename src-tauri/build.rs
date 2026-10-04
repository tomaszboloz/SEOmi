fn main() {
    let windows_msvc = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc");
    let attributes = if windows_msvc {
        // Supply one linker manifest for binaries, examples and test harnesses.
        // Keeping Tauri's resource manifest as well duplicates resource ID 1.
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest())
    } else {
        tauri_build::Attributes::new()
    };
    tauri_build::try_build(attributes).expect("Tauri build configuration must be valid");

    // rfd imports TaskDialogIndirect, which requires Common Controls v6 before
    // Windows resolves imports. This also applies to the lib-test executable.
    if windows_msvc {
        let manifest = std::path::PathBuf::from(
            std::env::var_os("CARGO_MANIFEST_DIR").expect("Cargo supplies the package directory"),
        )
        .join("windows-examples.manifest");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
}
