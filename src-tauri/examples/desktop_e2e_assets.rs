use tauri::{
    utils::{assets::AssetKey, mime_type::MimeType},
    Context, Runtime,
};

pub fn verified_context() -> Context<tauri::Wry> {
    let context = tauri::generate_context!();
    assert_embedded_frontend_mime(&context);
    context
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct AssetMimeSummary {
    pub script_count: usize,
    pub stylesheet_count: usize,
}

/// Check the MIME contract of the exact embedded assets used by the desktop runtime.
///
/// This deliberately runs `MimeType::parse` against the asset bytes, rather than
/// checking extensions alone. Tauri's MIME inference gives content signatures
/// precedence, so a JavaScript bundle containing a PDF magic sequence can be
/// served as `application/pdf` even when its path ends in `.js`.
pub fn assert_embedded_frontend_mime<R: Runtime>(context: &Context<R>) -> AssetMimeSummary {
    let mut summary = AssetMimeSummary::default();
    let mut mismatches = Vec::new();

    for (key, _) in context.assets().iter() {
        let key = key.as_ref();
        let expected = if key.ends_with(".js") || key.ends_with(".mjs") {
            summary.script_count += 1;
            Some("text/javascript")
        } else if key.ends_with(".css") {
            summary.stylesheet_count += 1;
            Some("text/css")
        } else {
            None
        };

        let Some(expected) = expected else { continue };
        let asset_key = AssetKey::from(key);
        let bytes = context
            .assets()
            .get(&asset_key)
            .unwrap_or_else(|| panic!("embedded asset could not be decompressed: {key}"));
        let actual = MimeType::parse(bytes.as_ref(), key);
        if actual != expected {
            mismatches.push(format!("{key}: expected {expected}, got {actual}"));
        }
    }

    assert!(
        summary.script_count > 0,
        "embedded frontend MIME preflight found no JavaScript assets"
    );
    assert!(
        summary.stylesheet_count > 0,
        "embedded frontend MIME preflight found no CSS assets"
    );
    assert!(
        mismatches.is_empty(),
        "embedded frontend MIME contract failed:\n{}",
        mismatches.join("\n")
    );

    summary
}
