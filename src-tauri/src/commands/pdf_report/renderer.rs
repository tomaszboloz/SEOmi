use super::charts::PdfChartBar;
use super::font::FontSet;
use super::font_pdf::{resource_refs, FontRefs};

#[path = "renderer_chart.rs"]
mod renderer_chart;

pub use renderer_chart::chart_stream;

pub(super) fn encoded_text(fonts: &mut FontSet, size: u8, text: &str) -> String {
    fonts
        .encode(text)
        .into_iter()
        .map(|run| {
            let actual = run
                .actual_text
                .filter(|value| !value.is_empty())
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

fn stream_object(stream: &str) -> Vec<u8> {
    format!(
        "<< /Length {} >>\nstream\n{}endstream",
        stream.len(),
        stream
    )
    .into_bytes()
}

fn page_object(content: usize, refs: &FontRefs) -> Vec<u8> {
    let latin = refs
        .latin
        .map(|id| format!("/F1 {id} 0 R "))
        .unwrap_or_default();
    let cjk = refs
        .cjk
        .map(|id| format!("/F2 {id} 0 R "))
        .unwrap_or_default();
    let arabic = refs
        .arabic
        .map(|id| format!("/F3 {id} 0 R "))
        .unwrap_or_default();
    format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << {latin}{cjk}{arabic}>> >> /Contents {content} 0 R >>").into_bytes()
}

pub fn pdf_bytes(lines: Vec<String>, chart: Option<Vec<PdfChartBar>>) -> Vec<u8> {
    let mut fonts = FontSet::new();
    let visual_lines = lines
        .iter()
        .flat_map(|line| fonts.wrapped_lines(line, 512.0, 10.0))
        .collect::<Vec<_>>();
    let page_chunks = visual_lines.chunks(48).collect::<Vec<_>>();
    let text_page_count = page_chunks.len().max(1);
    let page_count = text_page_count + usize::from(chart.is_some());
    let mut streams = page_chunks
        .iter()
        .map(|chunk| page_stream(&mut fonts, chunk))
        .collect::<Vec<_>>();
    if let Some(bars) = chart.as_deref() {
        streams.push(chart_stream_unicode(&mut fonts, bars));
    }
    let mut objects = vec![b"<< /Type /Catalog /Pages 2 0 R >>".to_vec(), Vec::new()];
    let refs = resource_refs(&fonts, &mut objects);
    let first_page = objects.len() + 1;
    let kids = (0..page_count)
        .map(|index| format!("{} 0 R", first_page + index * 2))
        .collect::<Vec<_>>()
        .join(" ");
    objects[1] = format!("<< /Type /Pages /Kids [{kids}] /Count {page_count} >>").into_bytes();
    for stream in &streams {
        let content = objects.len() + 2;
        objects.push(page_object(content, &refs));
        objects.push(stream_object(stream));
    }
    let mut bytes = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
    let mut offsets = vec![0usize];
    for (index, object) in objects.iter().enumerate() {
        offsets.push(bytes.len());
        bytes.extend_from_slice(format!("{} 0 obj\n", index + 1).as_bytes());
        bytes.extend_from_slice(object);
        bytes.extend_from_slice(b"\nendobj\n");
    }
    let xref_offset = bytes.len();
    bytes.extend_from_slice(
        format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).as_bytes(),
    );
    for offset in offsets.iter().skip(1) {
        bytes.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    bytes.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
            objects.len() + 1
        )
        .as_bytes(),
    );
    bytes
}
