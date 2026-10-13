use super::font::FontSet;

pub(super) fn encoded_text(
    fonts: &mut FontSet,
    size: impl std::fmt::Display,
    text: &str,
) -> String {
    fonts
        .encode(text)
        .into_iter()
        .map(|run| {
            let actual = run
                .actual_text
                .map(|value| format!("/Span << /ActualText <{}> >> BDC\n", utf16_hex(&value)))
                .unwrap_or_default();
            let end = if actual.is_empty() { "" } else { "EMC\n" };
            format!(
                "{actual}/{} {size} Tf\n<{}> Tj\n{end}",
                run.kind.resource(),
                run.hex
            )
        })
        .collect()
}

fn utf16_hex(value: &str) -> String {
    std::iter::once("FEFF".to_owned())
        .chain(value.encode_utf16().map(|unit| format!("{unit:04X}")))
        .collect()
}
