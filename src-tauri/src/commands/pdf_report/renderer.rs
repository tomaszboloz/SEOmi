use super::charts::PdfChartBar;
use super::font::FontSet;
use super::layout::assemble::assemble;

#[path = "renderer_chart.rs"]
mod renderer_chart;

pub use renderer_chart::chart_stream;

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

fn chart_stream_unicode(fonts: &mut FontSet, bars: &[PdfChartBar]) -> String {
    let mut stream = String::from("BT\n50 780 Td\n");
    stream.push_str(&encoded_text(fonts, 16, "Crawl metrics - saved run"));
    stream.push_str("ET\n");
    for (index, bar) in bars.iter().enumerate() {
        let y = 690_i32 - (index as i32 * 82);
        let width = 360_u64.saturating_mul(bar.value.min(bar.scale)) / bar.scale.max(1);
        stream.push_str("BT\n50 ");
        stream.push_str(&(y + 30).to_string());
        stream.push_str(" Td\n");
        stream.push_str(&encoded_text(
            fonts,
            10,
            &format!("{}: {}", bar.label, bar.value),
        ));
        stream.push_str("ET\n0.10 0.65 0.43 rg\n");
        stream.push_str(&format!(
            "190 {y} {width} 24 re f\n0.35 0.40 0.47 RG\n1 w\n190 {y} 360 24 re S\n"
        ));
    }
    stream
}

fn page_stream(fonts: &mut FontSet, lines: &[String]) -> String {
    let mut stream = String::from("BT\n50 792 Td\n");
    for (index, line) in lines.iter().enumerate() {
        if index > 0 {
            stream.push_str("0 -15 Td\n");
        }
        stream.push_str(&encoded_text(fonts, 10, line));
    }
    stream.push_str("ET\n");
    stream
}

pub fn pdf_bytes(lines: Vec<String>, chart: Option<Vec<PdfChartBar>>) -> Vec<u8> {
    let mut fonts = FontSet::new();
    let visual_lines = lines
        .iter()
        .flat_map(|line| fonts.wrapped_lines(line, 512.0, 10.0))
        .collect::<Vec<_>>();
    let mut page_chunks = visual_lines.chunks(48).collect::<Vec<_>>();
    if page_chunks.is_empty() {
        page_chunks.push(&[]);
    }
    let mut streams = page_chunks
        .iter()
        .map(|chunk| page_stream(&mut fonts, chunk))
        .collect::<Vec<_>>();
    if let Some(bars) = chart.as_deref() {
        streams.push(chart_stream_unicode(&mut fonts, bars));
    }
    assemble(&fonts, &streams, (612.0, 842.0))
}
